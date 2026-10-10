// Browser preview only. The packaged Tauri application uses the Rust server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const defaults = require('../app/default-state.json');
const clone = v => JSON.parse(JSON.stringify(v));
function merge(target, patch) {
 for (const [k,v] of Object.entries(patch)) {
  if (!Object.hasOwn(defaults,k)) continue;
  if (['a','b'].includes(k) && v && typeof v === 'object' && !Array.isArray(v)) Object.assign(target[k],v);
  else target[k] = v;
 }
 return target;
}
function normalize(value) {
 if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Invalid state');
 const s = clone(defaults);
 for (const [k,fallback] of Object.entries(defaults)) {
  const v = value[k];
  if (['a','b'].includes(k) && v && !Array.isArray(v) && typeof v === 'object') Object.assign(s[k],v);
  else if (typeof fallback === typeof v && v !== undefined && v !== null) s[k] = v;
 }
 const clamp = (v,lo,hi,fallback=lo) => Math.round(Math.max(lo,Math.min(hi,Number.isFinite(v)?v:fallback)));
 for (const k of ['accentColor','teamAColor','teamBColor','bgColor']) if (!/^#[0-9a-f]{6}$/i.test(s[k])) s[k]=defaults[k];
 s.hudScale=Math.max(90,Math.min(110,Number.isFinite(s.hudScale)?s.hudScale:100));
 s.bestOf=s.bestOf===3?3:5;const target=(s.bestOf+1)/2;
 for (const [k,lo,hi] of [['overlayStyle',1,8],['currentSet',1,s.bestOf],['scoreA',0,target],['scoreB',0,target],['bgOpacity',0,100],['hudTop',6,100]]) s[k]=clamp(s[k],lo,hi);
 for (const side of ['a','b']) {const counts={};for (const [k,max] of [['gen',5],['hook',12],['first',4]]) counts[k]=clamp(s[side][k],0,max);s[side]=counts;}
 if (s.killerSide!=='B') s.killerSide='A';
 for (const [k,limit] of [['teamA',48],['teamB',48],['championship',60]]) s[k]=Array.from(s[k]).slice(0,limit).join('');
 return s;
}

function createServer({stateFile}={}) {
 let state = clone(defaults);
 if (stateFile && fs.existsSync(stateFile)) state=normalize(JSON.parse(fs.readFileSync(stateFile,'utf8')));
 const clients = new Set();
 const root = path.resolve(__dirname,'../app');
 const allowed = new Set(['panel.html','panel.css','app.js','overlay.html','overlay.css','assets/generator.png','assets/hook.png','assets/killer.png','assets/survivor.png']);
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
 const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  if (url.pathname==='/events' && req.method==='GET') {
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
   res.write('data: '+JSON.stringify(state)+'\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
  }
  if (url.pathname==='/state' && req.method==='GET') {res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify(state));}
  if (url.pathname==='/state' && ['PATCH','POST'].includes(req.method)) {
   const origin=req.headers.origin;
   const port=server.address().port;
   if (origin && !['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin)) {res.writeHead(403);return res.end();}
   if (!req.headers['content-type']?.startsWith('application/json')) {res.writeHead(415);return res.end();}
   let body='',large=false;
   req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>65536){large=true;body='';}});
   req.on('end',()=>{
    if (large){res.writeHead(413);return res.end();}
    let next;
    try {const patch=JSON.parse(body);if (!patch || Array.isArray(patch) || typeof patch!=='object') throw Error();next=normalize(merge(clone(state),patch));}
    catch{res.writeHead(400);return res.end('Invalid JSON state');}
    try {
     if(stateFile){fs.mkdirSync(path.dirname(stateFile),{recursive:true});fs.writeFileSync(stateFile+'.tmp',JSON.stringify(next,null,2));fs.renameSync(stateFile+'.tmp',stateFile);}
    } catch{res.writeHead(500);return res.end('Persistence failed');}
    state=next;for(const client of clients)client.write('data: '+JSON.stringify(state)+'\n\n');
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(state));
   });return;
  }
  const file=url.pathname==='/'?'panel.html':url.pathname.slice(1);
  if(req.method!=='GET' || !allowed.has(file)){res.writeHead(404);return res.end('Not found');}
  fs.readFile(path.join(root,file),(error,data)=>{if(error){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});res.end(data);});
 });
 const heartbeat=setInterval(()=>{for(const c of clients)c.write(': keep-alive\n\n');},15000);heartbeat.unref();
 server.on('close',()=>clearInterval(heartbeat));
 server.stop=()=>{for(const client of clients)client.end();return new Promise(resolve=>server.close(resolve));};
 return server;
}
if (require.main===module) {
 const port=Number(process.env.DBD_PREVIEW_PORT||8766);
 const server=createServer({stateFile:path.resolve(__dirname,'../.preview-state/state.json')});
 server.on('error',error=>{console.error('Não foi possível iniciar a prévia:',error.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log('Prévia local: http://127.0.0.1:'+port+'/panel.html'));
}
module.exports={createServer,normalize};
