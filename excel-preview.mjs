import {unzipXlsx} from './session-upload.mjs';
const tags=(node,name)=>[...(node?.getElementsByTagNameNS('*',name)||[])];
const first=(node,name)=>tags(node,name)[0];
function xml(files,path){const bytes=files.get(path);if(!bytes)return null;const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'application/xml');if(doc.querySelector('parsererror'))throw Error('Le classeur contient un XML illisible.');return doc;}
function coordinates(ref){const match=/^([A-Z]+)(\d+)$/i.exec(ref||'');if(!match)return null;let col=0;for(const c of match[1].toUpperCase())col=col*26+c.charCodeAt(0)-64;return {col:col-1,row:Number(match[2])-1};}
function columnName(index){let s='';for(let n=index+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function zipPath(target){const stack=target.startsWith('/')?[]:['xl'];for(const part of target.split('/')){if(part==='..')stack.pop();else if(part&&part!=='.')stack.push(part);}return stack.join('/');}
const colorNames=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF'];
function color(node,theme){if(!node)return null;let hex=node.getAttribute('rgb')?.slice(-6);if(!hex&&node.hasAttribute('theme'))hex=theme[Number(node.getAttribute('theme'))];if(!hex&&node.hasAttribute('indexed'))hex=colorNames[Number(node.getAttribute('indexed'))%8];if(!/^[0-9a-f]{6}$/i.test(hex||''))return null;const tint=Number(node.getAttribute('tint')||0);if(tint)hex=hex.match(/../g).map(x=>{const v=parseInt(x,16);return Math.round(tint<0?v*(1+tint):v+(255-v)*tint).toString(16).padStart(2,'0');}).join('');return '#'+hex;}
function cellStyle(xf,fonts,fills,borders,theme){
 if(!xf)return {};
 const font=fonts[Number(xf.getAttribute('fontId')||0)],fill=fills[Number(xf.getAttribute('fillId')||0)],border=borders[Number(xf.getAttribute('borderId')||0)],align=first(xf,'alignment'),style={};
 if(first(font,'b'))style.fontWeight='700';if(first(font,'i'))style.fontStyle='italic';
 const size=Number(first(font,'sz')?.getAttribute('val'));if(size)style.fontSize=Math.min(48,Math.max(9,size))*4/3+'px';
 const foreground=color(first(font,'color'),theme);if(foreground)style.color=foreground;
 const pattern=first(fill,'patternFill');if(pattern?.getAttribute('patternType')==='solid'){const background=color(first(pattern,'fgColor'),theme);if(background)style.backgroundColor=background;}
 const horizontal=align?.getAttribute('horizontal');if(['left','center','right','justify'].includes(horizontal))style.textAlign=horizontal;
 const vertical=align?.getAttribute('vertical');style.verticalAlign=vertical==='center'?'middle':vertical==='top'?'top':'bottom';
 if(align?.getAttribute('wrapText')==='1')style.whiteSpace='pre-wrap';
 for(const [side,css] of [['left','borderLeft'],['right','borderRight'],['top','borderTop'],['bottom','borderBottom']]){const edge=first(border,side),kind=edge?.getAttribute('style');if(kind&&kind!=='none')style[css]=`${/thick|double/.test(kind)?3:/medium/.test(kind)?2:1}px ${/dash|dotted/.test(kind)?'dashed':'solid'} ${color(first(edge,'color'),theme)||'#a7b1a5'}`;}
 return style;
}
function formattedCell(cell,shared,formats,date1904){
 const type=cell.getAttribute('t'),value=first(cell,'v')?.textContent??'';
 if(type==='s')return shared[Number(value)]||'';if(type==='inlineStr')return tags(cell,'t').map(t=>t.textContent).join('');if(type==='b')return value==='1'?'VRAI':'FAUX';if(type==='str'||type==='e')return value;
 if(value==='')return first(cell,'f')?'='+first(cell,'f').textContent:'';
 const number=Number(value),format=formats.get(Number(cell.getAttribute('s')||0))||'';
 if(!Number.isFinite(number))return value;
 if(format.includes('%'))return (number*100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
 if(/[dy]/i.test(format.replace(/"[^"]*"/g,''))&&number>0&&number<100000){const date=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+number*86400000);return date.toLocaleDateString('fr-FR',{timeZone:'UTC'});}
 const decimals=format.match(/\.([0#]+)/)?.[1].length;
 return number.toLocaleString('fr-FR',{useGrouping:false,maximumFractionDigits:decimals===undefined?6:Math.min(decimals,8),minimumFractionDigits:decimals===undefined?0:Math.min(decimals,8)});
}
export async function readWorkbookPreview(buffer){
 const files=await unzipXlsx(buffer),workbook=xml(files,'xl/workbook.xml'),rels=xml(files,'xl/_rels/workbook.xml.rels');
 if(!workbook||!rels)throw Error('Ce document ne peut pas être affiché ici. Téléchargez l’original pour l’ouvrir dans Excel.');
 const shared=tags(xml(files,'xl/sharedStrings.xml'),'si').map(item=>tags(item,'t').map(t=>t.textContent).join(''));
 const styles=xml(files,'xl/styles.xml'),fonts=tags(first(styles,'fonts'),'font'),fills=tags(first(styles,'fills'),'fill'),borders=tags(first(styles,'borders'),'border'),xfs=tags(first(styles,'cellXfs'),'xf');
 const themeDoc=xml(files,'xl/theme/theme1.xml'),scheme=first(themeDoc,'clrScheme'),theme=[];
 const themeOrder=['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
 for(const name of themeOrder){const c=first(scheme,name)?.firstElementChild;theme.push(c?.getAttribute('lastClr')||c?.getAttribute('val')||'');}
 const codes=new Map([[0,'General'],[1,'0'],[2,'0.00'],[9,'0%'],[10,'0.00%'],[14,'dd/mm/yyyy']]);for(const f of tags(styles,'numFmt'))codes.set(Number(f.getAttribute('numFmtId')),f.getAttribute('formatCode')||'');
 const formats=new Map(xfs.map((xf,i)=>[i,codes.get(Number(xf.getAttribute('numFmtId')))||'']));
 const relationMap=new Map(tags(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const sheets=[];
 for(const sheet of tags(workbook,'sheet').slice(0,20)){
  const target=relationMap.get(sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id'));if(!target)continue;const doc=xml(files,zipPath(target));if(!doc)continue;
  const cells=new Map(),merges=[],covered=new Set(),widths=new Map(),heights=new Map();let maxRow=0,maxCol=0,truncated=false;
  for(const cell of tags(doc,'c')){const at=coordinates(cell.getAttribute('r'));if(!at)continue;if(at.row>=300||at.col>=50){if(first(cell,'v')||first(cell,'is'))truncated=true;continue;}cells.set(`${at.row},${at.col}`,{text:formattedCell(cell,shared,formats,first(workbook,'workbookPr')?.getAttribute('date1904')==='1'),style:cellStyle(xfs[Number(cell.getAttribute('s')||0)],fonts,fills,borders,theme)});maxRow=Math.max(maxRow,at.row);maxCol=Math.max(maxCol,at.col);}
  for(const merge of tags(doc,'mergeCell')){const [a,b]=merge.getAttribute('ref').split(':').map(coordinates);if(!a||!b||a.row>=300||a.col>=50)continue;const end={row:Math.min(b.row,299),col:Math.min(b.col,49)};merges.push({a,b:end});maxRow=Math.max(maxRow,end.row);maxCol=Math.max(maxCol,end.col);for(let r=a.row;r<=end.row;r++)for(let c=a.col;c<=end.col;c++)if(r!==a.row||c!==a.col)covered.add(`${r},${c}`);}
  for(const col of tags(doc,'col'))for(let c=Math.max(0,Number(col.getAttribute('min'))-1);c<Math.min(50,Number(col.getAttribute('max')));c++)widths.set(c,Math.min(420,Math.max(45,Number(col.getAttribute('width')||10)*7+5)));
  for(const row of tags(doc,'row'))if(row.hasAttribute('ht'))heights.set(Number(row.getAttribute('r'))-1,Math.min(200,Math.max(24,Number(row.getAttribute('ht'))*4/3)));
  // Style-only cells and distant empty merges are not part of the used area.
  const populated=[...cells].filter(([,cell])=>cell.text.trim()!=='').map(([key])=>key.split(',').map(Number));
  let range=null;
  if(populated.length){
   range={startRow:Math.min(...populated.map(c=>c[0])),endRow:Math.max(...populated.map(c=>c[0])),startCol:Math.min(...populated.map(c=>c[1])),endCol:Math.max(...populated.map(c=>c[1]))};
   let expanded=true;while(expanded){expanded=false;for(const {a,b} of merges){if(a.row>range.endRow||b.row<range.startRow||a.col>range.endCol||b.col<range.startCol)continue;const next={startRow:Math.min(range.startRow,a.row),endRow:Math.max(range.endRow,b.row),startCol:Math.min(range.startCol,a.col),endCol:Math.max(range.endCol,b.col)};if(Object.keys(next).some(k=>next[k]!==range[k])){range=next;expanded=true;}}}
  }
  sheets.push({name:sheet.getAttribute('name')||'Feuille',cells,merges,covered,widths,heights,range,rows:range?range.endRow-range.startRow+1:0,cols:range?range.endCol-range.startCol+1:0,truncated});
 }
 if(!sheets.length)throw Error('Aucune feuille lisible. Téléchargez l’original pour l’ouvrir dans Excel.');
 return sheets;
}
export function workbookTable(sheet){
 const table=document.createElement('table');table.className='excel-table';table.setAttribute('aria-label',sheet.name);
 if(!sheet.range)return table;
 const {startRow,endRow,startCol,endCol}=sheet.range;
 let width=34;const cols=document.createElement('colgroup');cols.append(document.createElement('col'));for(let c=startCol;c<=endCol;c++){const col=document.createElement('col'),size=sheet.widths.get(c)||100;col.style.width=size+'px';width+=size;cols.append(col);}table.style.width=width+'px';table.append(cols);
 const head=document.createElement('thead'),tr=document.createElement('tr');tr.append(document.createElement('th'));for(let c=startCol;c<=endCol;c++){const th=document.createElement('th');th.textContent=columnName(c);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
 const spans=new Map(sheet.merges.map(m=>[`${m.a.row},${m.a.col}`,m])),body=document.createElement('tbody');
 for(let r=startRow;r<=endRow;r++){const row=document.createElement('tr');if(sheet.heights.has(r))row.style.height=sheet.heights.get(r)+'px';const number=document.createElement('th');number.scope='row';number.textContent=r+1;row.append(number);for(let c=startCol;c<=endCol;c++){const key=`${r},${c}`;if(sheet.covered.has(key))continue;const td=document.createElement('td'),data=sheet.cells.get(key),merge=spans.get(key);if(data){td.textContent=data.text;Object.assign(td.style,data.style);}if(merge){td.rowSpan=merge.b.row-merge.a.row+1;td.colSpan=merge.b.col-merge.a.col+1;}row.append(td);}body.append(row);}table.append(body);return table;
}
