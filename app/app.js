let pendingReset=null, resetFocus=null;
let state, pending=[], sending=false, events, retryTimer;
const $=s=>document.querySelector(s);
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Math.round(Number(v)||0)));
function merge(target,patch){for(const [k,v] of Object.entries(patch)){if(['a','b'].includes(k))Object.assign(target[k] ||= {},v);else target[k]=v;}return target;}
function scaleActual(display){return 90+(clamp(display,50,100)-50)*.4;}
function scaleDisplay(actual){return Math.round(50+(Math.max(90,Math.min(110,Number(actual)||100))-90)/.4);}
function normalizeLocal(){state.hudTop=clamp(state.hudTop??78,6,100);state.hudScale=Math.max(90,Math.min(110,Number(state.hudScale)||100));state.bgOpacity=clamp(state.bgOpacity??85,0,100);state.bgColor ||= '#151d23';state.bestOf=state.bestOf===3?3:5;const max=(state.bestOf+1)/2;for(const s of ['A','B'])state['score'+s]=clamp(state['score'+s],0,max);state.currentSet=clamp(state.currentSet,1,state.bestOf);}
function edit(patch){merge(state,patch);normalizeLocal();const last=pending.length-1;if(last>=0&&(!sending||last>0))merge(pending[last],clone(patch));else pending.push(clone(patch));render();flush();}
function step(side,key,delta){const limits={gen:5,hook:12,first:4};counterValue(side,key,clamp(state[side][key]+delta,0,limits[key]));}
function counterValue(side,key,value){const limits={gen:5,hook:12,first:4};edit({[side]:{[key]:clamp(value,0,limits[key])}});}
function scoreStep(side,delta){scoreValue(side,state['score'+side]+delta);}
function scoreValue(side,value){edit({['score'+side]:clamp(value,0,(state.bestOf+1)/2)});}
const defaultColors={"teamAColor":"#8ba99f","teamBColor":"#94a1b8","bgColor":"#151d23","accentColor":"#d4dedf"};
function resetColor(key){if(Object.hasOwn(defaultColors,key))edit({[key]:defaultColors[key]});}
let overlayDragId=null,overlayDragOffset=14;
function positionFromPointer(event){const pad=$('#positionPad'),handle=$('#positionHandle'),rect=pad.getBoundingClientRect(),travel=rect.height-16-handle.offsetHeight;edit({hudTop:clamp(6+((event.clientY-rect.top-overlayDragOffset-8)/travel)*94,6,100)});}
function startOverlayDrag(event){if(event.button!==0||overlayDragId!==null)return;event.preventDefault();const handle=$('#positionHandle');overlayDragOffset=event.target.closest('#positionHandle')?event.clientY-handle.getBoundingClientRect().top:handle.offsetHeight/2;overlayDragId=event.pointerId;handle.focus();$('#positionPad').setPointerCapture(event.pointerId);$('#positionPad').classList.add('dragging');positionFromPointer(event);}
function moveOverlayDrag(event){if(event.pointerId===overlayDragId)positionFromPointer(event);}
function endOverlayDrag(event){if(event.pointerId!==overlayDragId)return;overlayDragId=null;const pad=$('#positionPad');pad.classList.remove('dragging');if(pad.hasPointerCapture(event.pointerId))pad.releasePointerCapture(event.pointerId);}
function positionKey(event){const steps={ArrowUp:-1,ArrowDown:1,PageUp:-10,PageDown:10};let value;if(event.key==='Home')value=6;else if(event.key==='End')value=100;else if(Object.hasOwn(steps,event.key))value=state.hudTop+steps[event.key]*(event.shiftKey?5:1);else return;event.preventDefault();edit({hudTop:clamp(value,6,100)});}
function resetScores(){requestReset('scores');}
function resetCounters(){requestReset('counters');}
function requestReset(kind){pendingReset=kind;resetFocus=document.activeElement;$('#resetTitle').textContent=kind==='scores'?'Zerar placar?':'Zerar contadores?';$('#resetDescription').textContent=kind==='scores'?'As vitórias dos dois times serão zeradas. Os contadores permanecem.':'Geradores, ganchos e primeiros ganchos dos dois times serão zerados. O placar permanece.';$('#resetDialog').showModal();}
function cancelReset(){pendingReset=null;$('#resetDialog').close();resetFocus?.focus();}
function applyReset(kind){if(kind==='scores')edit({scoreA:0,scoreB:0});else if(kind==='counters')edit({a:{gen:0,hook:0,first:0},b:{gen:0,hook:0,first:0}});}
function confirmReset(){const kind=pendingReset;cancelReset();if(kind)applyReset(kind);}
function status(message,error=false){$('#connectionDot').title=message;$('#connectionDot').setAttribute('aria-label',message);$('#connectionDot').classList.toggle('error',error);$('#connectionStatus').hidden=!error;$('#connectionStatus').textContent=error?message:'';}
function setInput(id,value){const input=$('#'+id);if(input!==document.activeElement)input.value=value;}
function render(){
 normalizeLocal();
 document.documentElement.style.setProperty('--a',state.teamHighlights===false?state.accentColor:state.teamAColor);
 document.documentElement.style.setProperty('--b',state.teamHighlights===false?state.accentColor:state.teamBColor);
 $('#teamHighlights').checked=state.teamHighlights!==false;
 $('#overlayGradient').checked=state.overlayGradient!==false;
 const handle=$('#positionHandle');handle.style.top=(8+(state.hudTop-6)/94*48)+'px';handle.setAttribute('aria-valuenow',state.hudTop);handle.setAttribute('aria-valuetext',state.hudTop+' pixels do topo');
 document.body.className=state.overlayStyle<=4?'numeric':state.overlayStyle===6?'bars':state.overlayStyle===7?'circles':state.overlayStyle===8?'chevrons':'diamonds';
 for(const k of ['championship','teamA','teamB','scoreA','scoreB','overlayStyle','bestOf','teamAColor','teamBColor','accentColor','bgColor','bgOpacity'])setInput(k,state[k]);
 const sets=$('#setButtons');if(sets.children.length!==state.bestOf)sets.innerHTML=Array.from({length:state.bestOf},(_,i)=>'<button type="button" aria-label="Set '+(i+1)+'" onclick="edit({currentSet:'+(i+1)+'})">'+(i+1)+'</button>').join('');for(const [i,button] of [...sets.children].entries()){const selected=i+1===state.currentSet;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
 setInput('hudScale',scaleDisplay(state.hudScale));$('#scaleValue').textContent=scaleDisplay(state.hudScale);$('#opacityValue').textContent=state.bgOpacity+'%';
 document.querySelector('input[name=killerSide][value="'+state.killerSide+'"]').checked=true;
 const target=(state.bestOf+1)/2;
 for(const side of ['A','B']){
  const scoreInput=$('#score'+side);scoreInput.max=target;
  const scoreRow=scoreInput.parentElement;scoreRow.querySelector('button:first-child').disabled=state['score'+side]<=0;scoreRow.querySelector('button:last-child').disabled=state['score'+side]>=target;
  $('#wins'+side).innerHTML=Array.from({length:target},(_,i)=>'<i class="'+(i<state['score'+side]?'won':'')+'"></i>').join('');
  const role=$('#panelRole'+side),killer=state.killerSide===side;role.src='assets/'+(killer?'killer':'survivor')+'.png';role.alt=killer?'Killer':'Survivors';role.title=killer?'Killer':'Survivors';
 }
 for(const side of ['a','b'])for(const [key,max] of [['gen',5],['hook',12],['first',4]]){
  setInput(side+key,state[side][key]);const row=$('#'+side+key).closest('.counter');row.querySelector('.minus').disabled=state[side][key]<=0;row.querySelector('.plus').disabled=state[side][key]>=max;
 }
}
async function flush(){
 if(sending||!pending.length)return;sending=true;let failed=false;status('Salvando…');
 try{
  while(pending.length){
   const response=await fetch('/state',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending[0])});
   if(!response.ok)throw Error('HTTP '+response.status);
   const confirmed=await response.json();pending.shift();state=confirmed;for(const patch of pending)merge(state,patch);render();
  }
  const latest=await fetch('/state');if(!latest.ok)throw Error('HTTP '+latest.status);state=await latest.json();for(const patch of pending)merge(state,patch);render();status('Sincronizado');
 }catch(error){failed=true;status('Falha ao salvar. Tentando reconectar…',true);}
 finally{sending=false;if(pending.length){clearTimeout(retryTimer);retryTimer=setTimeout(flush,failed?1500:0);}}
}
async function load(){
 try{
  const response=await fetch('/state');if(!response.ok)throw Error();state=await response.json();render();$('#resetDialog').addEventListener('cancel',()=>{pendingReset=null;});
  $('#obsUrl').value=location.origin+'/overlay.html';$('#panelUrl').value=location.origin+'/panel.html';
  events?.close();events=new EventSource('/events');events.onmessage=event=>{if(sending||pending.length)return;state=JSON.parse(event.data);render();status('Sincronizado');};events.onerror=()=>status('Servidor desconectado. Reconectando…',true);status('Sincronizado');
 }catch(error){status('Servidor indisponível. Reconectando…',true);setTimeout(load,1500);}
}
async function copyUrl(id,button){try{await navigator.clipboard.writeText($('#'+id).value);button.textContent='Copiado';setTimeout(()=>button.textContent='Copiar',1800);}catch{const input=$('#'+id);input.select();button.textContent='Ctrl+C';}}
window.addEventListener('DOMContentLoaded',load);
