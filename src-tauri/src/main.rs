#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod server;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_clipboard_manager::ClipboardExt;

fn show_panel(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show_panel(app)))
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let port = tauri::async_runtime::block_on(server::start(data_dir))?;
            let base = format!("http://127.0.0.1:{port}");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(format!("{base}/panel.html").parse()?))
                .title("DBD Tournament Control")
                .inner_size(410.0, 650.0).min_inner_size(320.0, 420.0).build()?;
            let open = MenuItem::with_id(app, "open", "Abrir painel", true, None::<&str>)?;
            let copy = MenuItem::with_id(app, "copy", "Copiar URL da overlay", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair e encerrar overlay", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &copy, &quit])?;
            let overlay_url = format!("{base}/overlay.html");
            let mut tray = TrayIconBuilder::new().tooltip("DBD Tournament Overlay — servidor ativo")
                .menu(&menu).on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => show_panel(app),
                    "copy" => { let _ = app.clipboard().write_text(&overlay_url); },
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!());
    if let Err(error) = result {
        // Windows GUI builds have no console; display startup failures natively.
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::ffi::OsStrExt;
            #[link(name = "user32")]
            extern "system" { fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, kind: u32) -> i32; }
            let message: Vec<u16> = std::ffi::OsStr::new(&format!("Não foi possível iniciar o aplicativo.\n\n{error}\n\nVerifique se outro servidor está usando a porta 8766."))
                .encode_wide().chain(Some(0)).collect();
            let caption: Vec<u16> = std::ffi::OsStr::new("DBD Tournament Overlay").encode_wide().chain(Some(0)).collect();
            unsafe { MessageBoxW(0, message.as_ptr(), caption.as_ptr(), 0x10); }
        }
        eprintln!("{error}");
        std::process::exit(1);
    }
}
