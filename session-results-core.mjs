// Decimal comma/dot, repetitions separated by a dash or slash.
export function normalizeSessionDistances(value,count) {
 if(!Array.isArray(value)||value.length!==count)throw new Error('Les distances doivent correspondre aux chronos, dans le même ordre.');
 return value.map(distance=>{
  if(distance===null)return null;
  if(typeof distance!=='number'||!Number.isFinite(distance)||distance<=0||distance>100000)throw new Error('Chaque distance doit être supérieure à 0 et au plus égale à 100 000 mètres, ou laissée vide.');
  return distance;
 });
}
export function parseSessionTimes(value) {
 if(typeof value!=='string'||!value.trim()||value.length>4000)throw new Error('Saisissez au moins un chrono (4000 caractères maximum).');
 const tokens=value.trim().split(/[\/\-–—]+/).map(token=>token.trim()).filter(Boolean);
 if(!tokens.length||tokens.length>200)throw new Error('Saisissez de 1 à 200 chronos.');
 return tokens.map(token=>{
  if(!/^(?:\d+[:][0-5]?\d|\d+)(?:[.,]\d{1,3})?$/.test(token))throw new Error('Chrono invalide. Exemple : 25.8 / 48.2 / 24.4 / 25');
  const parts=token.replace(',','.').split(':'),seconds=parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(parts[0]);
  if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw new Error('Chaque chrono doit être positif et inférieur ou égal à 24 heures.');
  return seconds;
 });
}
