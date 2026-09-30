// Transcription en lecture seule de la feuille « 20262027 » du classeur source.
// L'Excel décrit des semaines entières ; aucune date de jour n'est inventée.
export const seasonStart = '2026-08-31';
export const seasonWeekCount = 105; // S105 commence le 28 août 2028.
export const generalPeriods = [
 {start:1,end:4,label:'Reprise',tone:'reprise'},
 {start:5,end:17,label:'Développement général → orienté → spécifique',tone:'developpement'},
 {start:18,end:25,label:'Compétitions hivernales',tone:'hiver'}
];
export const trainingPeriods = [
 {start:1,end:4,label:'Conditionnement physique',tone:'conditionnement'},
 {start:5,end:16,label:'Préparation',tone:'preparation'},
 {start:17,end:20,label:'Spécifique',tone:'specifique'},
 {start:21,end:27,label:'Compétition',tone:'competition'}
];
export const intensityPeriods = [
 {start:5,end:8,label:'Intensité moyenne · volume moyen',tone:'equilibre'},
 {start:9,end:12,label:'Intensité élevée · volume faible',tone:'intense'},
 {start:13,end:16,label:'Intensité faible · volume élevé',tone:'volume'}
];
export const schoolHolidays = [
 {start:8,end:9,label:'Vacances scolaires IDF'},
 {start:16,end:17,label:'Vacances scolaires IDF'},
 {start:23,end:24,label:'Vacances scolaires IDF'}
];
export const absences = []; // Ligne présente dans le classeur, mais vide.
export const stages = [{start:17,end:17,label:'Stage'}];
export const seasonNotes = [{start:18,end:18,label:'Noël + NA'}];
export const competitions = [
 {week:18,label:'Reg CJ'},
 {week:20,label:'Reg ES'},
 {week:21,label:'IDF CJ'},
 {week:22,label:'IDF ES'},
 {week:23,label:'FRA CJ'},
 {week:24,label:'ELITE'},
 {week:27,label:'ES-NAT'}
];
const importedLoads = ['light','medium','medium','light','medium','medium','high','light','medium','high','high','light','medium','high','high','light','high','light','light','light','light','light','light','light'];
export const weeklyLoads = [...importedLoads,...Array(seasonWeekCount-importedLoads.length).fill(null)];
export const defaultSeason={generalPeriods,trainingPeriods,intensityPeriods,schoolHolidays,absences,stages,seasonNotes,competitions,weeklyLoads};

export function normalizeSeason(input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Repères de saison invalides.');
 const groups=['generalPeriods','trainingPeriods','intensityPeriods','schoolHolidays','absences','stages','seasonNotes'];
 const result={};
 for(const name of groups){
  const items=input[name];
  if(!Array.isArray(items)||items.length>60)throw new Error('Liste de périodes invalide.');
  result[name]=items.map(item=>{
   if(!item||!Number.isInteger(item.start)||!Number.isInteger(item.end)||item.start<1||item.end>seasonWeekCount||item.start>item.end||typeof item.label!=='string'||!item.label.trim()||item.label.length>180)throw new Error(`Période invalide : choisissez des semaines S1 à S${seasonWeekCount} et un libellé.`);
   const tone=typeof item.tone==='string'&&/^(reprise|developpement|hiver|conditionnement|preparation|specifique|competition|equilibre|intense|volume|custom)$/.test(item.tone)?item.tone:'custom';
   return {start:item.start,end:item.end,label:item.label.trim(),tone};
  }).sort((a,b)=>a.start-b.start);
  for(let i=1;i<result[name].length;i++)if(result[name][i].start<=result[name][i-1].end)throw new Error('Deux repères de même type ne peuvent pas couvrir la même semaine.');
 }
 if(!Array.isArray(input.competitions)||input.competitions.length>seasonWeekCount)throw new Error('Compétitions invalides.');
 result.competitions=input.competitions.map(item=>{
  if(!item||!Number.isInteger(item.week)||item.week<1||item.week>seasonWeekCount||typeof item.label!=='string'||!item.label.trim()||item.label.length>180)throw new Error('Compétition invalide.');
  return {week:item.week,label:item.label.trim()};
 }).sort((a,b)=>a.week-b.week);
 if(new Set(result.competitions.map(item=>item.week)).size!==result.competitions.length)throw new Error('Une seule entrée de compétition par semaine : regroupez les noms dans un même libellé.');
 if(!Array.isArray(input.weeklyLoads)||input.weeklyLoads.length!==seasonWeekCount||input.weeklyLoads.some(level=>![null,'light','medium','high'].includes(level)))throw new Error('Charges hebdomadaires invalides.');
 result.weeklyLoads=[...input.weeklyLoads];
 return result;
}

const DAY=86400000;
const START=Date.UTC(2026,7,31);
export function seasonWeekDate(week) {
 if(!Number.isInteger(week)||week<1||week>seasonWeekCount)return null;
 return new Date(START+(week-1)*7*DAY).toISOString().slice(0,10);
}
export function seasonWeekForDate(key,season=defaultSeason) {
 season ||= defaultSeason;
 if(typeof key!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const timestamp=Date.parse(`${key}T00:00:00Z`);
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==key)return null;
 const number=Math.floor((timestamp-START)/(7*DAY))+1;
 if(number<1||number>seasonWeekCount)return null;
 const inRange=(items)=>items.find(item=>number>=item.start&&number<=item.end)||null;
 return {number,start:seasonWeekDate(number),load:season.weeklyLoads[number-1],general:inRange(season.generalPeriods),training:inRange(season.trainingPeriods),intensity:inRange(season.intensityPeriods),holiday:inRange(season.schoolHolidays),absence:inRange(season.absences||[]),stage:inRange(season.stages),note:inRange(season.seasonNotes),competition:season.competitions.find(item=>item.week===number)||null};
}
