import {readWorkbookPreview,workbookTable} from './excel-preview.mjs';
let panel=null,downloadUrl=null,generation=0,returnFocus=null,zoom=null;
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
// Scale only the workbook, never the surrounding site. Keep the sheet point
// under the fingers/cursor fixed; the canvas supplies the real scroll bounds.
function enableWorkbookZoom(content,table,saved){
 const canvas=element('div',undefined,'workbook-canvas');table.before(canvas);canvas.append(table);
 const naturalWidth=table.offsetWidth,naturalHeight=table.offsetHeight,pointers=new Map(),listeners=[];
 let scale=1,automatic=!saved||saved.automatic,gesture=null,safari=false,inertia=0,samples=[];
 const stopInertia=()=>{cancelAnimationFrame(inertia);inertia=0;};
 const record=()=>{const time=performance.now();samples.push({time,x:content.scrollLeft,y:content.scrollTop});samples=samples.filter(point=>time-point.time<=100);};
 const coast=()=>{
  if(samples.length<2||performance.now()-samples.at(-1).time>80)return;
  const first=samples[0],last=samples.at(-1),elapsed=last.time-first.time;if(elapsed<8)return;
  let vx=Math.max(-3,Math.min(3,(last.x-first.x)/elapsed)),vy=Math.max(-3,Math.min(3,(last.y-first.y)/elapsed)),previous=performance.now();
  const frame=now=>{
   const dt=Math.min(40,now-previous);previous=now;
   const left=content.scrollLeft,top=content.scrollTop,decay=Math.exp(-dt/240);
   content.scrollLeft+=vx*240*(1-decay);content.scrollTop+=vy*240*(1-decay);
   vx=Math.abs(content.scrollLeft-left)<.1?0:vx*decay;vy=Math.abs(content.scrollTop-top)<.1?0:vy*decay;
   if(Math.hypot(vx,vy)>.025)inertia=requestAnimationFrame(frame);else inertia=0;
  };
  if(Math.hypot(vx,vy)>.025)inertia=requestAnimationFrame(frame);
 };
 const available=()=>Math.max(1,content.clientWidth-parseFloat(getComputedStyle(content).paddingLeft)-parseFloat(getComputedStyle(content).paddingRight));
 const paint=()=>{canvas.style.width=naturalWidth*scale+'px';canvas.style.height=naturalHeight*scale+'px';table.style.transform=`scale(${scale})`;canvas.dataset.scale=String(scale);};
 const change=(next,x,y)=>{
  const rect=table.getBoundingClientRect(),pointX=(x-rect.left)/scale,pointY=(y-rect.top)/scale;
  scale=Math.min(4,Math.max(.01,next));paint();const after=table.getBoundingClientRect();
  content.scrollLeft+=after.left+pointX*scale-x;content.scrollTop+=after.top+pointY*scale-y;
 };
 scale=saved?.scale??Math.min(1,available()/naturalWidth);paint();content.scrollLeft=saved?.left||0;content.scrollTop=saved?.top||0;
 const on=(name,handler,options)=>{content.addEventListener(name,handler,options);listeners.push(()=>content.removeEventListener(name,handler,options));};
 on('wheel',event=>{stopInertia();if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();if(safari)return;automatic=false;const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?content.clientHeight:1);change(scale*Math.exp(-delta*.01),event.clientX,event.clientY);},{passive:false});
 const snapshot=()=>{const points=[...pointers.values()];if(points.length>=2){const [a,b]=points;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};}return points[0]||null;};
 on('pointerdown',event=>{stopInertia();if(event.pointerType==='mouse')return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});content.setPointerCapture(event.pointerId);gesture=snapshot();samples=[];if(pointers.size===1)record();});
 on('pointermove',event=>{if(!pointers.has(event.pointerId))return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const next=snapshot();if(!safari&&gesture&&next){if(gesture.distance&&next.distance){automatic=false;change(scale*next.distance/gesture.distance,gesture.x,gesture.y);}content.scrollLeft-=next.x-gesture.x;content.scrollTop-=next.y-gesture.y;if(pointers.size===1)record();else samples=[];}gesture=next;},{passive:false});
 const release=event=>{if(!pointers.has(event.pointerId))return;const fling=event.type==='pointerup'&&pointers.size===1&&!safari;pointers.delete(event.pointerId);gesture=snapshot();if(fling)coast();samples=[];if(pointers.size===1)record();};on('pointerup',release);on('pointercancel',release);on('lostpointercapture',release);
 // Safari exposes trackpad pinches as gesture events rather than ctrl+wheel.
 let safariStart=1;
 on('gesturestart',event=>{event.preventDefault();stopInertia();samples=[];safari=true;automatic=false;safariStart=scale;},{passive:false});
 on('gesturechange',event=>{event.preventDefault();const rect=content.getBoundingClientRect();change(safariStart*event.scale,event.clientX||rect.left+rect.width/2,event.clientY||rect.top+rect.height/2);},{passive:false});
 on('gestureend',event=>{event.preventDefault();safari=false;},{passive:false});
 const observer=new ResizeObserver(()=>{stopInertia();if(automatic){scale=Math.min(1,available()/naturalWidth);paint();}});observer.observe(content);
 const visibility=()=>{if(document.hidden)stopInertia();};document.addEventListener('visibilitychange',visibility);
 return {state:()=>({scale,automatic,left:content.scrollLeft,top:content.scrollTop}),destroy:()=>{stopInertia();observer.disconnect();document.removeEventListener('visibilitychange',visibility);listeners.forEach(remove=>remove());}};
}
function createPanel(){
 if(panel)return;
 panel=element('aside',undefined,'workbook-viewer');panel.id='workbook-viewer';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','workbook-title');
 const header=element('div',undefined,'workbook-header'),heading=element('div');heading.append(element('small','DOCUMENT DE SÉANCE'),element('h2','Classeur Excel'));heading.lastElementChild.id='workbook-title';
 const actions=element('div',undefined,'workbook-actions'),download=element('a','Télécharger','secondary workbook-download');download.id='workbook-download';download.hidden=true;
 const close=element('button','×','icon-button');close.type='button';close.setAttribute('aria-label','Fermer le document Excel');close.onclick=closeWorkbookViewer;actions.append(download,close);header.append(heading,actions);
 const tabs=element('div',undefined,'workbook-tabs');tabs.id='workbook-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Feuilles du classeur');
 const content=element('div',undefined,'workbook-content');content.id='workbook-content';content.tabIndex=0;content.setAttribute('role','tabpanel');content.setAttribute('aria-label','Aperçu du classeur');
 const footer=element('p','Aperçu en lecture seule. Pour la mise en page complète, téléchargez l’original.','workbook-footer');panel.append(header,tabs,content,footer);document.body.append(panel);
 document.addEventListener('pointerdown',event=>{if(panel.hidden||panel.contains(event.target)||event.target.closest('#navigation,#account,.site-header'))return;closeWorkbookViewer();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeWorkbookViewer();}});
}
export function closeWorkbookViewer(){generation++;zoom?.destroy();zoom=null;if(panel)panel.hidden=true;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}if(panel){panel.querySelector('#workbook-content').replaceChildren();panel.querySelector('#workbook-tabs').replaceChildren();panel.querySelector('#workbook-title').textContent='Classeur Excel';const a=panel.querySelector('#workbook-download');a.removeAttribute('href');a.removeAttribute('download');a.hidden=true;}if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
export async function openWorkbookViewer(file,api){
 createPanel();closeWorkbookViewer();returnFocus=document.activeElement;const requestGeneration=++generation;panel.hidden=false;
 panel.querySelector('#workbook-title').textContent=file.filename;const content=panel.querySelector('#workbook-content'),tabs=panel.querySelector('#workbook-tabs');content.textContent='Ouverture du classeur…';panel.querySelector('button').focus();
 try{
  const saved=await api('/attachments/'+encodeURIComponent(file.id));if(generation!==requestGeneration)return;
  const binary=atob(saved.contentBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),link=panel.querySelector('#workbook-download');
  downloadUrl=URL.createObjectURL(new Blob([bytes],{type:saved.mime}));link.href=downloadUrl;link.download=saved.filename;link.hidden=false;panel.querySelector('#workbook-title').textContent=saved.filename;
  if(/\.xls$/i.test(saved.filename)){content.textContent='Ce format Excel ancien peut être téléchargé et ouvert dans Excel. Pour l’aperçu intégré, utilisez un fichier .xlsx.';return;}
  const sheets=await readWorkbookPreview(bytes.buffer);if(generation!==requestGeneration)return;
  const states=new Map();let selected=null;
  const show=index=>{
   if(zoom){states.set(selected,zoom.state());zoom.destroy();zoom=null;}selected=index;
   const sheet=sheets[index];content.replaceChildren();content.scrollTop=0;content.scrollLeft=0;if(sheet.truncated)content.append(element('p','Aperçu limité aux 300 premières lignes et 50 colonnes. Le fichier original est complet.','workbook-warning'));
   if(sheet.range){const table=workbookTable(sheet);content.append(table);zoom=enableWorkbookZoom(content,table,states.get(index));}else content.append(element('p','Feuille vide.'));
   tabs.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
  };
  sheets.forEach((sheet,i)=>{const button=element('button',sheet.name);button.type='button';button.setAttribute('role','tab');button.onclick=()=>show(i);button.onkeydown=event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?sheets.length-1:(i+(event.key==='ArrowRight'?1:-1)+sheets.length)%sheets.length;show(next);tabs.children[next].focus();}};tabs.append(button);});show(0);
 }catch(error){if(generation===requestGeneration)content.textContent=error.message||'Aperçu indisponible. Vous pouvez télécharger le fichier original.';}
}
