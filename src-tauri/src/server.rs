use axum::{extract::{State, DefaultBodyLimit}, http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response, sse::{Sse, Event, KeepAlive}}, routing::get, Json, Router};
use serde_json::{Value, json};
use std::{sync::Arc, path::PathBuf, convert::Infallible};
use tokio::sync::{Mutex, watch};

#[derive(Clone)]
struct Store { value: Arc<Mutex<Value>>, tx: watch::Sender<String>, file: PathBuf }

fn defaults() -> Value { serde_json::from_str(include_str!("../../app/default-state.json")).unwrap() }
fn merge(target: &mut Value, patch: &Value) {
    if let (Some(target), Some(patch)) = (target.as_object_mut(), patch.as_object()) {
        for (key, value) in patch {
            if matches!(key.as_str(), "a" | "b") && value.is_object() {
                merge(target.entry(key.clone()).or_insert(json!({})), value);
            } else { target.insert(key.clone(), value.clone()); }
        }
    }
}
fn normalize(value: &Value) -> Result<Value, StatusCode> {
    if !value.is_object() { return Err(StatusCode::BAD_REQUEST); }
    let mut result = defaults();
    for (key, fallback) in defaults().as_object().unwrap() {
        if let Some(v) = value.get(key) {
            if matches!(key.as_str(), "a" | "b") && v.is_object() { merge(&mut result[key], v); }
            else if (fallback.is_string() && v.is_string()) || (fallback.is_number() && v.is_number()) || (fallback.is_boolean() && v.is_boolean()) {
                result[key] = v.clone();
            }
        }
    }
    for key in ["accentColor", "teamAColor", "teamBColor", "bgColor"] {
        let s = result[key].as_str().unwrap_or("");
        if s.len() != 7 || !s.starts_with('#') || !s[1..].bytes().all(|b| b.is_ascii_hexdigit()) { result[key] = defaults()[key].clone(); }
    }
    result["bestOf"] = json!(if result["bestOf"].as_f64() == Some(3.) { 3 } else { 5 });
    result["hudScale"] = json!(result["hudScale"].as_f64().unwrap_or(100.).clamp(90.,110.));
    let best_of = result["bestOf"].as_f64().unwrap();
    let target = (best_of + 1.) / 2.;
    for (key, lo, hi) in [("overlayStyle",1.,8.),("currentSet",1.,best_of),("scoreA",0.,target),("scoreB",0.,target),("bgOpacity",0.,100.),("hudTop",6.,100.)] {
        result[key] = json!(result[key].as_f64().unwrap_or(lo).clamp(lo,hi).round() as i64);
    }
    for side in ["a","b"] {
        let mut counts = json!({});
        for (key, max) in [("gen",5.),("hook",12.),("first",4.)] {
            counts[key] = json!(result[side][key].as_f64().unwrap_or(0.).clamp(0.,max).round() as i64);
        }
        result[side] = counts;
    }
    if result["killerSide"] != "B" { result["killerSide"] = json!("A"); }
    for (key, limit) in [("teamA",48),("teamB",48),("championship",60)] {
        result[key] = json!(result[key].as_str().unwrap_or("").chars().take(limit).collect::<String>());
    }
    Ok(result)
}

fn valid_origin(headers: &HeaderMap) -> bool {
    headers.get(header::ORIGIN).map(|origin| origin.to_str().ok().map(|s|
        ["http://localhost:8765", "http://127.0.0.1:8765"].contains(&s)).unwrap_or(false)).unwrap_or(true)
}
async fn read(State(store): State<Store>) -> Json<Value> { Json(store.value.lock().await.clone()) }
async fn write(State(store): State<Store>, headers: HeaderMap, Json(patch): Json<Value>) -> Result<Json<Value>, StatusCode> {
    if !valid_origin(&headers) { return Err(StatusCode::FORBIDDEN); }
    if !patch.is_object() { return Err(StatusCode::BAD_REQUEST); }
    let mut current = store.value.lock().await;
    let mut next = current.clone();
    merge(&mut next, &patch);
    next = normalize(&next)?;
    let serialized = serde_json::to_vec_pretty(&next).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    // Hold the lock through persistence so edits from multiple panels stay ordered.
    let temporary = store.file.with_extension("json.tmp");
    tokio::fs::write(&temporary, serialized).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    tokio::fs::rename(&temporary, &store.file).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    *current = next.clone();
    store.tx.send_replace(next.to_string());
    Ok(Json(next))
}
async fn events(State(store): State<Store>) -> impl IntoResponse {
    let mut rx = store.tx.subscribe();
    Sse::new(async_stream::stream! {
        let initial = rx.borrow_and_update().clone();
        yield Ok::<_, Infallible>(Event::default().data(initial));
        while rx.changed().await.is_ok() {
            let data = rx.borrow_and_update().clone();
            yield Ok(Event::default().data(data));
        }
    }).keep_alive(KeepAlive::default())
}
async fn asset(uri: axum::http::Uri) -> Response {
    let (data, mime): (&[u8], &str) = match uri.path() {
        "/" | "/panel.html" => (include_bytes!("../../app/panel.html"), "text/html; charset=utf-8"),
        "/panel.css" => (include_bytes!("../../app/panel.css"), "text/css; charset=utf-8"),
        "/app.js" => (include_bytes!("../../app/app.js"), "text/javascript; charset=utf-8"),
        "/overlay.html" => (include_bytes!("../../app/overlay.html"), "text/html; charset=utf-8"),
        "/overlay.css" => (include_bytes!("../../app/overlay.css"), "text/css; charset=utf-8"),
        "/assets/generator.png" => (include_bytes!("../../app/assets/generator.png"), "image/png"),
        "/assets/hook.png" => (include_bytes!("../../app/assets/hook.png"), "image/png"),
        "/assets/killer.png" => (include_bytes!("../../app/assets/killer.png"), "image/png"),
        "/assets/survivor.png" => (include_bytes!("../../app/assets/survivor.png"), "image/png"),
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    ([(header::CONTENT_TYPE, mime), (header::CACHE_CONTROL, "no-cache")], data).into_response()
}
pub async fn start(dir: PathBuf) -> Result<u16, Box<dyn std::error::Error>> {
    tokio::fs::create_dir_all(&dir).await?;
    let file = dir.join("state.json");
    let value = match tokio::fs::read(&file).await {
        Ok(bytes) => normalize(&serde_json::from_slice::<Value>(&bytes)?)
            .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "state.json inválido"))?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => defaults(),
        Err(e) => return Err(e.into()),
    };
    let (tx, _) = watch::channel(value.to_string());
    let router = Router::new().route("/state", get(read).patch(write).post(write))
        .route("/events", get(events)).fallback(asset)
        .layer(DefaultBodyLimit::max(64 * 1024))
        .with_state(Store { value: Arc::new(Mutex::new(value)), tx, file });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8765").await?;
    let port = listener.local_addr()?.port();
    tauri::async_runtime::spawn(async move { if let Err(e) = axum::serve(listener, router).await { eprintln!("{e}"); } });
    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn repairs_and_clamps() {
        let s = normalize(&json!({"a":{"gen":999},"scoreA":-4,"overlayStyle":30,"teamAColor":"red","hudScale":140})).unwrap();
        assert_eq!(s["a"]["gen"],5); assert_eq!(s["a"]["hook"],0);
        assert_eq!(s["scoreA"],0); assert_eq!(s["overlayStyle"],8); assert_eq!(s["teamAColor"],defaults()["teamAColor"]);
        assert_eq!(s["hudScale"].as_f64(),Some(110.));
    }
    #[test] fn partial_counter_edits_preserve_other_counters() {
        let mut s = defaults(); s["a"]["hook"] = json!(7);
        merge(&mut s,&json!({"a":{"gen":2}}));
        assert_eq!(s["a"]["hook"],7); assert_eq!(s["a"]["gen"],2);
    }
    #[test] fn rejects_non_object() { assert!(normalize(&json!([])).is_err()); }
    #[test] fn series_and_styles_share_the_same_score() {
        let md3 = normalize(&json!({"bestOf":3,"scoreA":3,"scoreB":1,"currentSet":5})).unwrap();
        assert_eq!(md3["scoreA"],2); assert_eq!(md3["scoreB"],1); assert_eq!(md3["currentSet"],3);
        for style in 1..=8 {
            let mut changed = md3.clone(); changed["overlayStyle"] = json!(style);
            let normalized = normalize(&changed).unwrap();
            assert_eq!(normalized["scoreA"],2); assert_eq!(normalized["scoreB"],1);
        }
        assert!(md3.get("roleIconScale").is_none());
    }
}
