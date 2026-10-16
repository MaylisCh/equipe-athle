const DAY=86400000;
const weekdayAliases={lun:1,lundi:1,mar:2,mardi:2,mer:3,mercredi:3,jeu:4,jeudi:4,ven:5,vendredi:5,sam:6,samedi:6,dim:7,dimanche:7};
const dateHeader=/^(?:dates?|date(?: de la)? seance|date du jour|jour|semaine(?: du)?|week|debut)$/i;
const normalize=value=>String(value??'').replace(/^\uFEFF/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/\s+/g,' ').trim();

function matrixFromCsv(text) {
 const first=text.split(/\r?\n/,8).filter(Boolean).join('\n');
 const counts=[',',';','\t'].map(delimiter=>{let n=0,quoted=false;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(first[i]===delimiter&&!quoted)n++;}return n;});
 const delimiter=[',',';','\t'][counts.indexOf(Math.max(...counts))];
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;continue;}
  if(!quoted&&char===delimiter){row.push(value);value='';continue;}
  if(!quoted&&(char==='\n'||char==='\r')){if(char==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(cell=>cell.trim()))rows.push(row);row=[];value='';continue;}
  value+=char;
 }
 row.push(value);if(row.some(cell=>cell.trim()))rows.push(row);
 return rows.map(cells=>cells.map(text=>({text:String(text??'').trim(),date:false})));
}

async function unzipXlsx(buffer) {
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('Le fichier XLSX est illisible.');
 const count=view.getUint16(eocd+10,true),directory=view.getUint32(eocd+16,true),files=new Map();let at=directory,totalSize=0;
 if(count>300)throw Error('Le classeur contient trop de fichiers.');
 for(let i=0;i<count;i++){
  if(view.getUint32(at,true)!==0x02014b50)throw Error('Le classeur XLSX est incomplet.');
  const method=view.getUint16(at+10,true),compressed=view.getUint32(at+20,true),uncompressed=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));
  if(compressed>18_000_000)throw Error('Un fichier du classeur dépasse la taille maximale.');
  if(/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml))$/.test(name)){
   totalSize+=uncompressed;if(uncompressed>24_000_000||totalSize>40_000_000)throw Error('Le classeur décompressé dépasse la taille maximale.');
   const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=bytes.slice(start,start+compressed);
   if(method===0)files.set(name,data);
   else if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Ce navigateur ne sait pas ouvrir les classeurs XLSX. Enregistre plutôt le fichier en CSV.');try{const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));files.set(name,new Uint8Array(await new Response(stream).arrayBuffer()));}catch{throw Error('Le navigateur ne peut pas ouvrir ce classeur XLSX. Enregistre-le en CSV puis réessaie.');}}
   else throw Error('Méthode de compression XLSX non prise en charge.');
  }
  at+=46+nameLength+extraLength+commentLength;
 }
 return files;
}

function xmlFile(files,path) {
 const bytes=files.get(path);if(!bytes)return null;
 const xml=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'application/xml');
 if(xml.querySelector('parsererror'))throw Error('Structure XML invalide dans le classeur.');
 return xml;
}
const tag=(node,name)=>node?.getElementsByTagNameNS('*',name)||[];
function resolveZipPath(target){const parts=target.startsWith('/')?target.slice(1).split('/'):['xl',...target.split('/')];return parts.reduce((path,part)=>part==='..'?path.slice(0,-1):part==='.'?path:[...path,part],[]).join('/');}
function columnIndex(reference){let n=0;for(const c of reference.match(/^[A-Z]+/i)?.[0]||''){n=n*26+c.toUpperCase().charCodeAt(0)-64;}return n-1;}
function spreadsheetDate(number){if(!Number.isFinite(number)||number<1||number>100000)return null;return new Date(Date.UTC(1899,11,30)+number*DAY).toISOString().slice(0,10);}

async function matrixFromXlsx(buffer) {
 const files=await unzipXlsx(buffer),workbook=xmlFile(files,'xl/workbook.xml'),rels=xmlFile(files,'xl/_rels/workbook.xml.rels');
 if(!workbook||!rels)throw Error('Aucun classeur XLSX reconnu.');
 const relationMap=new Map([...tag(rels,'Relationship')].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const sharedXml=xmlFile(files,'xl/sharedStrings.xml'),shared=[...tag(sharedXml,'si')].map(item=>[...tag(item,'t')].map(t=>t.textContent).join(''));
 const styleXml=xmlFile(files,'xl/styles.xml'),customFormats=new Map([...tag(styleXml,'numFmt')].map(item=>[Number(item.getAttribute('numFmtId')),item.getAttribute('formatCode')||'']));
 const xfs=[...tag(styleXml,'cellXfs')][0],dateStyles=new Set();
 [...(xfs?.children||[])].forEach((xf,index)=>{const id=Number(xf.getAttribute('numFmtId'));if((id>=14&&id<=22)||(id>=45&&id<=47)||/[dmy]/i.test(customFormats.get(id)||''))dateStyles.add(index);});
 const result=[];
 for(const sheet of [...tag(workbook,'sheet')]){
  const relationId=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sheet.getAttribute('r:id');
  const target=relationMap.get(relationId)||'';const path=resolveZipPath(target);
  const doc=xmlFile(files,path);if(!doc)continue;
  const grid=[];
  for(const row of [...tag(doc,'row')]){
   const cells=[];
   for(const cell of [...tag(row,'c')]){
    const ref=cell.getAttribute('r')||'',column=columnIndex(ref),kind=cell.getAttribute('t'),value=[...tag(cell,'v')][0]?.textContent||'';
    let text=value;if(kind==='s')text=shared[Number(value)]||'';else if(kind==='inlineStr')text=[...tag(cell,'t')].map(t=>t.textContent).join('');
    const numeric=kind===''||kind==='n',styledDate=numeric&&dateStyles.has(Number(cell.getAttribute('s')||0));
    if(styledDate)text=spreadsheetDate(Number(value))||text;
    cells[column]={text:String(text??'').trim(),date:styledDate};
   }
   if(cells.some(cell=>cell?.text))grid[Number(row.getAttribute('r'))-1]=cells;
  }
  if(grid.length)result.push({name:sheet.getAttribute('name')||'Feuille',rows:grid});
 }
 return result;
}

function parseDate(value,now=new Date()) {
 const text=String(value??'').trim();if(!text)return null;
 if(/^\d{5}(?:\.0+)?$/.test(text)&&Number(text)>=20000&&Number(text)<=80000)return spreadsheetDate(Number(text));
 const iso=text.matchAll(/(?:^|\D)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?:\D|$)/g);
 for(const match of iso){const [,y,m,d]=match;const parsed=validDate(Number(y),Number(m),Number(d));if(parsed)return parsed;}
 const local=text.matchAll(/(?:^|\D)(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?(?:\D|$)/g),parts=[];
 for(const match of local){const day=Number(match[1]),month=Number(match[2]);let year=match[3]?Number(match[3]):null;if(year&&year<100)year+=2000;if(year){const parsed=validDate(year,month,day);if(parsed)return parsed;}else if(validDate(2024,month,day))parts.push({day,month});}
 if(!parts.length)return null;
 const paris=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=k=>Number(paris.find(p=>p.type===k).value),today=Date.UTC(get('year'),get('month')-1,get('day'));
 const {day,month}=parts[parts.length-1],candidates=[get('year')-1,get('year'),get('year')+1].map(y=>validDate(y,month,day)).filter(Boolean);
 if(!candidates.length)return null;
 return candidates.sort((a,b)=>Math.abs(Date.parse(a)-today)-Math.abs(Date.parse(b)-today))[0];
}
function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?d.toISOString().slice(0,10):null;}
function monday(key){const d=new Date(`${key}T00:00:00Z`),weekday=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-weekday);return d.toISOString().slice(0,10);}
function addDays(key,offset){const d=new Date(`${key}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
function parseWeekDate(cell,now){const raw=String(cell?.text||'');const serial=cell?.date?parseDate(raw,now):null;return serial||parseDate(raw,now);}
function hasExplicitYear(cell){return /20\d{2}/.test(String(cell?.text||''));}
function dayNumber(value){const text=normalize(value);const explicit=text.match(/^(?:jour|j)\s*(\d{1,2})$/);if(explicit)return Number(explicit[1]);return weekdayAliases[text]||null;}
function dateColumn(rows){
 for(let r=0;r<Math.min(rows.length,20);r++)for(let c=0;c<(rows[r]?.length||0);c++){
  const label=normalize(rows[r][c]?.text);if(!dateHeader.test(label))continue;
  const next=rows.slice(r+1).filter(row=>row?.[c]?.text&&parseDate(row[c].text));if(next.length)return {headerRow:r,column:c,first:next[0]};
 }
 return null;
}
function guessType(title,body=''){
 const text=normalize(`${title} ${body}`);
 if(/muscu|renforcement|renfo|condition physique|force max|puissance force/.test(text))return 'strength';
 if(/competition|championnat|meeting/.test(text))return 'competition';
 if(/montsouris|cite u|sceaux|cote|côte|colline/.test(text))return 'hills';
 if(/vo2|v02|vma|developpement/.test(text))return 'vo2';
 if(/endu|capacite|capacite|seuil|footing/.test(text))return 'endurance';
 if(/sprint|vitesse|acceleration|haie|relais/.test(text))return 'speed';
 return 'group';
}
function splitCondition(value){
 const match=String(value||'').match(/\b(?:si|en cas de|dans le cas de|selon)\s+.+$/i);if(!match)return null;
 let title=String(value).slice(0,match.index).replace(/[\s([{:;,–—-]+$/,'').trim();
 title=title.replace(/^repos\s+ou\s+/i,'').replace(/\s+ou\s+repos$/i,'').trim();
 if(!title)return null;
 const subtitle=match[0].trim().replace(/[)\].,;]+$/,'');
 return {title,subtitle:subtitle.charAt(0).toLocaleUpperCase('fr')+subtitle.slice(1)};
}
function parseSession(cell,date,source){
 const raw=String(cell?.text??'').replace(/\r/g,'').trim();
 if(!raw)return {date,rest:true,source};
 if(/^repos[.!]?$/i.test(raw))return {date,rest:true,source};
 let lines=raw.split('\n').map(s=>s.trim()).filter(Boolean),v2='';
 const v2Index=lines.findIndex(line=>/^v\s*2\s*[:=\-]?/i.test(line));
 if(v2Index>=0){v2=lines.slice(v2Index).join('\n').replace(/^v\s*2\s*[:=\-]?\s*/i,'').trim();lines=lines.slice(0,v2Index);}
 const warmup=[];
 lines=lines.filter(line=>{
  if(/\ba l['’ ]?echauffement\b/.test(normalize(line))||/\bechauffement\s*:/i.test(normalize(line))){warmup.push(line.replace(/\s*[-–—:]?\s*(?:(?:à|a) l['’ ]?(?:é|e)chauffement|(?:é|e)chauffement)\s*:?/i,'').trim()||line);return false;}
  return true;
 });
 const v2Warmup=[];
 const keptV2=v2.split('\n').filter(line=>{
  if(/\ba l['’ ]?echauffement\b/.test(normalize(line))||/\bechauffement\s*:/i.test(normalize(line))){v2Warmup.push(line.replace(/\s*[-–—:]?\s*(?:(?:à|a) l['’ ]?(?:é|e)chauffement|(?:é|e)chauffement)\s*:?/i,'').trim()||line);return false;}
  return true;
 });
 v2=keptV2.join('\n').trim();warmup.push(...v2Warmup);
 if(lines.length>1&&/^(?:renfo(?:rcement)?|gammes|mobilite|activation|med(?:icine)?[ .-]*ball|corde|footing|educatifs?)(?:\b|\s)/.test(normalize(lines[0])))warmup.push(lines.shift());
 let title=lines[0]||raw.split('\n')[0],subtitle='';
 const titleCondition=splitCondition(title);if(titleCondition){title=titleCondition.title;subtitle=titleCondition.subtitle;}
 const conditionLineIndex=lines.findIndex((line,index)=>index>0&&/^(?:si|en cas de|dans le cas de|selon)\b/i.test(normalize(line)));
 if(conditionLineIndex>=0&&!subtitle){subtitle=lines.splice(conditionLineIndex,1)[0].trim();subtitle=subtitle.charAt(0).toLocaleUpperCase('fr')+subtitle.slice(1);}
 title=title.trim();title=title.charAt(0).toLocaleUpperCase('fr')+title.slice(1);title=title.slice(0,180);
 const workout=lines.slice(1).join('\n').trim();
 const full=[title,...lines.slice(1)].join('\n');
 return {date,rest:false,title,subtitle:subtitle.slice(0,180),type:guessType(title,full),warmup:warmup.join('\n').trim(),workout:workout||full,v2,source};
}

function rowForDateTable(sheet,now){
 const {rows}=sheet;let found=dateColumn(rows),firstData=found?.headerRow+1;
 if(!found){
  let best=null;
  for(let column=0;column<Math.max(...rows.slice(0,20).map(row=>row?.length||0),0);column++){
   const matches=rows.reduce((count,row)=>count+(row?.[column]?.text&&parseWeekDate(row[column],now)?1:0),0);
   if(matches>=2&&matches>(best?.matches||0))best={headerRow:-1,column,matches};
  }
  if(!best)return null;found=best;firstData=0;
 }
 const {headerRow,column}=found,header=rows[headerRow]||[],dateValues=[];
 if(header.filter(cell=>weekdayAliases[normalize(cell?.text)]).length>=3)return null;
 const dateWord=normalize(header[column]?.text);
 const titleColumn=header.findIndex((cell,index)=>index!==column&&/^(?:titre(?: de la seance)?|type|activite|nom)$/i.test(normalize(cell?.text)));
 let sessionColumn=header.findIndex((cell,index)=>index!==column&&index!==titleColumn&&/^(?:seance|entrainement|contenu|details|workout|session)$/i.test(normalize(cell?.text)));
 if(sessionColumn<0){
  const width=Math.max(...rows.slice(Math.max(0,headerRow+1),Math.max(20,headerRow+2)).map(row=>row?.length||0),0),start=Math.max(0,headerRow+1);let best=0;
  for(let c=0;c<width;c++)if(c!==column&&c!==titleColumn){const count=rows.slice(start).reduce((n,row)=>n+(row?.[c]?.text?1:0),0);if(count>best){best=count;sessionColumn=c;}}
 }
 const warmupColumn=header.findIndex(cell=>/^(?:echauffement|warm ?up|mise en route)$/i.test(normalize(cell?.text)));
 const conditionColumn=header.findIndex(cell=>/^(?:condition|sous ?titre|precisions?)$/i.test(normalize(cell?.text)));
 let previous='';
 for(let r=firstData;r<rows.length;r++){
  const cell=rows[r]?.[column];if(!cell?.text)continue;
  const date=parseWeekDate(cell,now);if(!date)continue;
  let key=date;if(!hasExplicitYear(cell)&&previous&&key<previous&&Number(key.slice(5,7))<Number(previous.slice(5,7)))key=`${Number(previous.slice(0,4))+1}${key.slice(4)}`;
  previous=key;
  const explicitTitle=titleColumn>=0?rows[r]?.[titleColumn]?.text:'';
  const content=headerRow<0?(rows[r]||[]).filter((item,index)=>index!==column&&item?.text&&!weekdayAliases[normalize(item.text)]).map(item=>item.text).join('\n'):sessionColumn>=0?rows[r]?.[sessionColumn]?.text:explicitTitle;
  const warm=warmupColumn>=0?rows[r]?.[warmupColumn]?.text:'';
  const condition=conditionColumn>=0?rows[r]?.[conditionColumn]?.text:'';
  const entry=parseSession({text:content},key,sheet.name);
  if(explicitTitle&&!entry.rest){const split=splitCondition(explicitTitle);entry.title=(split?.title||explicitTitle).trim();entry.title=entry.title.charAt(0).toLocaleUpperCase('fr')+entry.title.slice(1);entry.title=entry.title.slice(0,180);if(split)entry.subtitle=split.subtitle;entry.type=guessType(entry.title,content);}
  if(warm&&!entry.rest)entry.warmup=warm;
  if(condition&&!entry.rest)entry.subtitle=condition.slice(0,180);
  dateValues.push(entry);
 }
 return dateValues.length?dateValues:null;
}

function weeklyMatrix(sheet,now){
 const {rows}=sheet,found=[];
 // Week dates across columns and day labels down rows, as in the existing Cycle tabs.
 for(let r=0;r<Math.min(rows.length,12);r++){
  const dated=[];for(let c=0;c<(rows[r]?.length||0);c++){const text=rows[r][c]?.text||'';if(/semaine|week/i.test(text)||rows[r][c]?.date){const date=parseWeekDate(rows[r][c],now);if(date)dated.push({column:c,date});}}
  const days=[];for(let rr=r+1;rr<rows.length;rr++){const n=dayNumber(rows[rr]?.[0]?.text);if(n)days.push({row:rr,day:n});}
  if(dated.length&&days.length>=3){
   let previous='';for(const week of dated){let start=week.date;if(!hasExplicitYear(rows[r]?.[week.column])&&previous&&start<previous&&Number(start.slice(5,7))<Number(previous.slice(5,7)))start=`${Number(previous.slice(0,4))+1}${start.slice(4)}`;previous=start;
    for(const item of days)found.push(parseSession(rows[item.row]?.[week.column],addDays(start,item.day-1),sheet.name));
   }
   return found;
  }
 }
 // Week dates down rows and weekdays across columns.
 for(let r=0;r<Math.min(rows.length,20);r++){
  const days=(rows[r]||[]).map((cell,c)=>({column:c,day:dayNumber(cell?.text)})).filter(x=>x.day);
  if(days.length<3)continue;
  const firstDateColumn=rows.slice(r+1).findIndex(row=>row?.some(cell=>parseWeekDate(cell,now)));
  if(firstDateColumn<0)continue;
  let previous='';
  for(let rr=r+1;rr<rows.length;rr++){
   const weekCell=rows[rr]?.find(cell=>parseWeekDate(cell,now));if(!weekCell)continue;
   let start=parseWeekDate(weekCell,now);if(!hasExplicitYear(weekCell)&&previous&&start<previous&&Number(start.slice(5,7))<Number(previous.slice(5,7)))start=`${Number(previous.slice(0,4))+1}${start.slice(4)}`;previous=start;
   const startMonday=monday(start);for(const item of days)found.push(parseSession(rows[rr]?.[item.column],addDays(startMonday,item.day-1),sheet.name));
  }
  if(found.length)return found;
 }
 // Each week is a row with seven weekday columns and its start date at left.
 for(let r=0;r<Math.min(rows.length,20);r++){
  const days=(rows[r]||[]).map((cell,c)=>({column:c,day:dayNumber(cell?.text)})).filter(x=>x.day);
  if(days.length<3)continue;
  const result=[];let previous='';
  for(let rr=r+1;rr<rows.length;rr++){
   const dateCell=rows[rr]?.find(cell=>parseWeekDate(cell,now));if(!dateCell)continue;
   let date=parseWeekDate(dateCell,now);if(!hasExplicitYear(dateCell)&&previous&&date<previous&&Number(date.slice(5,7))<Number(previous.slice(5,7)))date=`${Number(previous.slice(0,4))+1}${date.slice(4)}`;previous=date;
   const start=monday(date);for(const item of days)result.push(parseSession(rows[rr]?.[item.column],addDays(start,item.day-1),sheet.name));
  }
  if(result.length)return result;
 }
 return null;
}

function mergeDays(entries){
 const days=new Map();
 for(const entry of entries){const current=days.get(entry.date);if(!current||entry.rest){days.set(entry.date,entry);continue;}if(current.rest){days.set(entry.date,entry);continue;}
  current.workout=[current.workout,entry.workout].filter(Boolean).join('\n\n');current.title=[current.title,entry.title].filter(Boolean).join(' + ').slice(0,180);current.subtitle=[current.subtitle,entry.subtitle].filter(Boolean).join(' · ').slice(0,180);current.warmup=[current.warmup,entry.warmup].filter(Boolean).join('\n');current.source+=' / '+entry.source;
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

export async function parseTrainingFile(file,{now=new Date()}={}){
 if(!file||file.size>18_000_000)throw Error('Choisis un fichier de 18 Mo maximum.');
 const extension=file.name.toLowerCase().split('.').pop();let sheets;
 if(extension==='csv'||extension==='txt'){
  const bytes=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(bytes);if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(bytes);
  sheets=[{name:file.name,rows:matrixFromCsv(text)}];
 }
 else if(extension==='xlsx')sheets=await matrixFromXlsx(await file.arrayBuffer());
 else throw Error('Format non pris en charge. Choisis un fichier .xlsx ou .csv.');
 const entries=[];
 for(const sheet of sheets){const parsed=rowForDateTable(sheet,now)||weeklyMatrix(sheet,now);if(parsed?.length)entries.push(...parsed);}
 if(!entries.length)throw Error('Je n’ai pas reconnu de tableau daté. Ajoute une colonne Date, ou des dates de semaine avec les jours en lignes ou en colonnes.');
 const days=mergeDays(entries);if(days.length>500)throw Error('Le fichier contient plus de 500 journées.');
 return {filename:file.name,days,sheets:sheets.map(sheet=>sheet.name)};
}

export function nextWeekStartParis(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=name=>parts.find(value=>value.type===name).value;
 const day=new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`),weekday=day.getUTCDay();
 day.setUTCDate(day.getUTCDate()+(weekday===1?7:(8-weekday)%7));return day.toISOString().slice(0,10);
}
