const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('../scripts/preview.cjs');

test('OBS endpoints, independent edits, SSE, persistence and validation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dbd-test-'));
 const stateFile=path.join(dir,'state.json');
 let server=createServer({stateFile});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let base='http://127.0.0.1:'+server.address().port;
 const patch=async(value)=>fetch(base+'/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 const abort=new AbortController();
 try {
  for(const file of ['panel.html','overlay.html','panel.css','overlay.css','app.js','assets/killer.png'])assert.equal((await fetch(base+'/'+file)).status,200);
  assert.equal((await fetch(base+'/src-tauri/Cargo.toml')).status,404);
  const events=await fetch(base+'/events',{signal:abort.signal});const reader=events.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value),/data:/);
  await patch({a:{gen:3},teamA:'Time <A>'});
  assert.match(new TextDecoder().decode((await reader.read()).value),/Time <A>/);
  await patch({a:{hook:8},scoreB:2});
  let s=await (await fetch(base+'/state')).json();assert.equal(s.a.gen,3);assert.equal(s.a.hook,8);assert.equal(s.scoreB,2);
  await patch({a:{gen:999,first:-1},overlayStyle:30,teamAColor:'bad',scoreA:-4});
  s=await (await fetch(base+'/state')).json();assert.equal(s.a.gen,5);assert.equal(s.a.first,0);assert.equal(s.overlayStyle,8);assert.equal(s.teamAColor,'#8ba99f');assert.equal(s.scoreA,0);
  assert.equal((await patch([])).status,400);
  assert.equal((await fetch(base+'/state',{method:'PATCH',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'})).status,403);
  assert.equal((await patch({championship:'x'.repeat(70000)})).status,413);
  abort.abort();await server.stop();
  server=createServer({stateFile});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  s=await (await fetch(base+'/state')).json();assert.equal(s.scoreB,2);assert.equal(s.a.hook,8);assert.equal(s.teamA,'Time <A>');
 } finally {abort.abort();await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
