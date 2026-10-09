const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {normalize}=require('../scripts/preview.cjs');

test('background opacity, color and reduced scale bounds are validated',()=>{
 const low=normalize({bgOpacity:-1,bgColor:'invalid',hudScale:70});assert.equal(low.bgOpacity,0);assert.equal(low.bgColor,'#151d23');assert.equal(low.hudScale,90);
 const high=normalize({bgOpacity:200,bgColor:'#334455',hudScale:140});assert.equal(high.bgOpacity,100);assert.equal(high.bgColor,'#334455');assert.equal(high.hudScale,110);
 assert.equal(normalize({hudScale:100.4}).hudScale,100.4);
});

test('MD3/MD5 bound scores and sets without changing results when changing layouts',()=>{
 const md5=normalize({bestOf:5,scoreA:3,scoreB:1,currentSet:5,overlayStyle:5});
 assert.equal(md5.scoreA,3);assert.equal(md5.currentSet,5);
 const md3=normalize({...md5,bestOf:3});assert.equal(md3.scoreA,2);assert.equal(md3.scoreB,1);assert.equal(md3.currentSet,3);
 for(let style=1;style<=8;style++){
  const changed=normalize({...md3,overlayStyle:style});assert.equal(changed.scoreA,2);assert.equal(changed.scoreB,1);assert.equal(changed.overlayStyle,style);
 }
 const migrated=normalize({...md3,showRoles:false,showRoleLabels:true,roleIconScale:180,nameAX:100});
 for(const key of ['showRoles','showRoleLabels','roleIconScale','nameAX'])assert.equal(Object.hasOwn(migrated,key),false);
});

test('overlay renders exactly two MD3 or three MD5 wins, including empty/filled states',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../app/overlay.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const context=vm.createContext({document:{querySelector:()=>null},location:{search:''},URLSearchParams,EventSource:class {}});
 new vm.Script(script).runInContext(context);
 for(const [bestOf,target] of [[3,2],[5,3]]){
  for(let wins=0;wins<=target;wins++){
   const markup=context.victoryMarks(wins,bestOf);assert.equal((markup.match(/<i /g)||[]).length,target);assert.equal((markup.match(/ filled/g)||[]).length,wins);
  }
  assert.equal((context.victoryMarks(999,bestOf).match(/ filled/g)||[]).length,target);
 }
});
