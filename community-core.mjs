export const difficultyLabels=['Très facile','Facile','Modéré','Difficile','Très difficile'];
export const competitionLevels={'':'Non renseigné',departemental:'Départemental',regional:'Régional',interclubs:'Interclubs',national:'National',international:'International',meeting:'Meeting',autre:'Autre'};
const day=86400000;
export function validDateKey(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Date invalide.');
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw new Error('Date invalide.');
 return value;
}
export function mondayOf(value) {
 const date=new Date(validDateKey(value)+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 return date.toISOString().slice(0,10);
}
export function addDays(value,count) {
 return new Date(Date.parse(validDateKey(value)+'T12:00:00Z')+count*day).toISOString().slice(0,10);
}
export function isoWeekValue(value) {
 const monday=new Date(mondayOf(value)+'T12:00:00Z'),thursday=new Date(+monday+3*day),year=thursday.getUTCFullYear();
 const first=mondayOf(`${year}-01-04`),week=Math.round((+monday-Date.parse(first+'T12:00:00Z'))/(7*day))+1;
 return `${year}-W${String(week).padStart(2,'0')}`;
}
export function dateFromWeek(value) {
 if(typeof value!=='string'||!/^\d{4}-W\d{2}$/.test(value))throw new Error('Semaine invalide.');
 const [year,week]=value.split('-W'),date=addDays(mondayOf(`${year}-01-04`),(Number(week)-1)*7);
 if(isoWeekValue(date)!==value)throw new Error('Semaine invalide.');
 return date;
}
export function competitionData(body) {
 const text=(value,label,max,required=false)=>{
  if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`${label} invalide.`);
  return value.trim();
 };
 const date=body.date?validDateKey(body.date):null,weekStart=mondayOf(date||body.weekStart);
 if(!Object.hasOwn(competitionLevels,body.level||''))throw new Error('Niveau invalide.');
 return {title:text(body.title,'Nom de compétition',180,true),date,weekStart,location:text(body.location||'','Lieu',180),level:body.level||''};
}
export function publicDifficulty(comments) {
 const ratings=comments.filter(c=>!c.isPrivate&&Number.isInteger(c.rating));
 return {count:ratings.length,average:ratings.length?ratings.reduce((sum,c)=>sum+c.rating,0)/ratings.length:null};
}
