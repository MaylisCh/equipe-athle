import {readWorkbookPreview,workbookTable} from './excel-preview.mjs';
let panel=null,downloadUrl=null,generation=0,returnFocus=null;
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
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
export function closeWorkbookViewer(){generation++;if(panel)panel.hidden=true;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}if(panel){panel.querySelector('#workbook-content').replaceChildren();panel.querySelector('#workbook-tabs').replaceChildren();panel.querySelector('#workbook-title').textContent='Classeur Excel';const a=panel.querySelector('#workbook-download');a.removeAttribute('href');a.removeAttribute('download');a.hidden=true;}if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
export async function openWorkbookViewer(file,api){
 createPanel();closeWorkbookViewer();returnFocus=document.activeElement;const requestGeneration=++generation;panel.hidden=false;
 panel.querySelector('#workbook-title').textContent=file.filename;const content=panel.querySelector('#workbook-content'),tabs=panel.querySelector('#workbook-tabs');content.textContent='Ouverture du classeur…';panel.querySelector('button').focus();
 try{
  const saved=await api('/attachments/'+encodeURIComponent(file.id));if(generation!==requestGeneration)return;
  const binary=atob(saved.contentBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),link=panel.querySelector('#workbook-download');
  downloadUrl=URL.createObjectURL(new Blob([bytes],{type:saved.mime}));link.href=downloadUrl;link.download=saved.filename;link.hidden=false;panel.querySelector('#workbook-title').textContent=saved.filename;
  if(/\.xls$/i.test(saved.filename)){content.textContent='Ce format Excel ancien peut être téléchargé et ouvert dans Excel. Pour l’aperçu intégré, utilisez un fichier .xlsx.';return;}
  const sheets=await readWorkbookPreview(bytes.buffer);if(generation!==requestGeneration)return;
  const show=index=>{
   const sheet=sheets[index];content.replaceChildren();if(sheet.truncated)content.append(element('p','Aperçu limité aux 300 premières lignes et 50 colonnes. Le fichier original est complet.','workbook-warning'));content.append(workbookTable(sheet));content.scrollTop=0;content.scrollLeft=0;
   tabs.querySelectorAll('button').forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
  };
  sheets.forEach((sheet,i)=>{const button=element('button',sheet.name);button.type='button';button.setAttribute('role','tab');button.onclick=()=>show(i);button.onkeydown=event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?sheets.length-1:(i+(event.key==='ArrowRight'?1:-1)+sheets.length)%sheets.length;show(next);tabs.children[next].focus();}};tabs.append(button);});show(0);
 }catch(error){if(generation===requestGeneration)content.textContent=error.message||'Aperçu indisponible. Vous pouvez télécharger le fichier original.';}
}
