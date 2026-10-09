const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const defaults=require('../app/default-state.json');
const clone=v=>JSON.parse(JSON.stringify(v));

test('live edits send immediately, coalesce only unsent updates and preserve nested counters',async()=>{
 let releaseFirst, enteredFirst;
 const firstRequest=new Promise(resolve=>enteredFirst=resolve);
 const barrier=new Promise(resolve=>releaseFirst=resolve);
 const requests=[];let serverState=clone(defaults);
 const context=vm.createContext({window:{addEventListener(){}},setTimeout,clearTimeout,fetch:async(url,options)=>{
  if(options?.method==='PATCH'){
   const patch=JSON.parse(options.body);requests.push(patch);
   if(requests.length===1){enteredFirst();await barrier;}
   for(const [key,value] of Object.entries(patch)){if(['a','b'].includes(key))Object.assign(serverState[key],value);else serverState[key]=value;}
  }
  const snapshot=clone(serverState);return {ok:true,json:async()=>snapshot};
 }});
 new vm.Script(fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8')).runInContext(context);
 vm.runInContext('state='+JSON.stringify(defaults)+';render=()=>{};status=()=>{};',context);
 vm.runInContext("edit({teamA:'A'});",context);await firstRequest;
 vm.runInContext("edit({teamA:'AB'});edit({teamA:'ABC'});edit({hudScale:110});edit({hudScale:108});edit({a:{gen:2}});edit({a:{hook:7}});",context);
 assert.equal(requests.length,1);assert.equal(requests[0].teamA,'A');
 assert.equal(vm.runInContext('pending.length',context),2);
 releaseFirst();
 for(let i=0;i<20&&vm.runInContext('sending',context);i++)await new Promise(r=>setImmediate(r));
 assert.equal(requests.length,2);assert.equal(serverState.teamA,'ABC');assert.equal(serverState.hudScale,108);
 assert.equal(serverState.a.gen,2);assert.equal(serverState.a.hook,7);
 vm.runInContext("state.scoreA=2;state.scoreB=1;state.a.gen=4;flush=()=>{};applyReset('scores');",context);
 assert.equal(vm.runInContext('state.scoreA',context),0);assert.equal(vm.runInContext('state.scoreB',context),0);
 assert.equal(vm.runInContext('state.a.gen',context),4);
});

test('reset dialogs require confirmation and scale display maps 50–100 to 90–110',()=>{
 const nodes=Object.fromEntries(['#resetTitle','#resetDescription','#resetDialog'].map(id=>[id,{textContent:'',showModal(){this.open=true;},close(){this.open=false;}}]));
 const context=vm.createContext({window:{addEventListener(){}},document:{activeElement:null,querySelector:id=>nodes[id]}});
 new vm.Script(fs.readFileSync(path.join(__dirname,'../app/app.js'),'utf8')).runInContext(context);
 vm.runInContext('state='+JSON.stringify({...defaults,scoreA:2,a:{gen:3,hook:1,first:1}})+';render=()=>{};flush=()=>{};',context);
 vm.runInContext('resetScores();',context);assert.equal(vm.runInContext('state.scoreA',context),2);assert.equal(nodes['#resetDialog'].open,true);
 vm.runInContext('cancelReset();',context);assert.equal(vm.runInContext('state.scoreA',context),2);
 vm.runInContext('resetScores();confirmReset();',context);assert.equal(vm.runInContext('state.scoreA',context),0);assert.equal(vm.runInContext('state.a.gen',context),3);
 vm.runInContext('resetCounters();',context);assert.equal(vm.runInContext('state.a.gen',context),3);
 vm.runInContext('confirmReset();',context);assert.equal(vm.runInContext('state.a.gen',context),0);
 assert.equal(context.scaleActual(50),90);assert.equal(context.scaleActual(100),110);assert.equal(context.scaleActual(75),100);
 assert.equal(context.scaleDisplay(90),50);assert.equal(context.scaleDisplay(110),100);
});
