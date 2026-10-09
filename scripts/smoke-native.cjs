const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const exe=path.resolve('src-tauri/target/release/dbd-tournament-overlay.exe');
const base='http://127.0.0.1:8765';
let child;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){
 child=spawn(exe,[],{windowsHide:true,stdio:'ignore'});
 let spawnError;child.on('error',e=>{spawnError=e;});
 for(let n=0;n<150;n++){
  if(spawnError)throw spawnError;
  if(child.exitCode!==null)throw Error('Native app exited: '+child.exitCode);
  try{const r=await fetch(base+'/state',{signal:AbortSignal.timeout(1000)});if(r.ok)return await r.json();}catch{}
  await delay(200);
 }
 throw Error('Native local server did not start');
}
async function stop(){if(!child)return;const running=child;child=null;if(running.exitCode!==null)return;await new Promise(r=>{running.once('exit',r);running.kill();});await delay(700);}
async function patch(value){const r=await fetch(base+'/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});assert.equal(r.status,200);return r.json();}
(async()=>{
 try{
  await start();
  for(const url of ['/panel.html','/overlay.html','/app.js','/assets/killer.png'])assert.equal((await fetch(base+url)).status,200);
  const changed=await patch({teamA:'Native Smoke A',bestOf:3,scoreA:99,currentSet:99,hudTop:42,overlayGradient:false,a:{gen:4,hook:7,first:2}});
  assert.equal(changed.scoreA,2);assert.equal(changed.currentSet,3);assert.equal(changed.hudTop,42);assert.equal(changed.overlayGradient,false);
  const partial=await patch({a:{gen:2}});assert.equal(partial.a.hook,7);assert.equal(partial.a.first,2);
  const denied=await fetch(base+'/state',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'});assert.equal(denied.status,403);
  const controller=new AbortController();const events=await fetch(base+'/events',{signal:controller.signal});assert.equal(events.status,200);const reader=events.body.getReader();const initial=await reader.read();assert.match(new TextDecoder().decode(initial.value),/Native Smoke A/);controller.abort();
  await stop();const restored=await start();assert.equal(restored.teamA,'Native Smoke A');assert.equal(restored.hudTop,42);assert.equal(restored.a.hook,7);assert.equal(restored.overlayGradient,false);
  console.log('Native smoke passed: startup, assets, validation, SSE, local origin guard and persistence.');
 }finally{await stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
