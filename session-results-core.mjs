// One decimal time per token; punctuation other than comma/dot separates repetitions.
export function parseSessionTimes(value) {
 if(typeof value!=='string'||!value.trim()||value.length>4000)throw new Error('Saisissez au moins un chrono (4000 caractères maximum).');
 const tokens=value.trim().split(/[\s;\/\-–—]+/).filter(Boolean);
 if(!tokens.length||tokens.length>200)throw new Error('Saisissez de 1 à 200 chronos.');
 return tokens.map(token=>{
  if(!/^(?:\d+[:][0-5]?\d|\d+)(?:[.,]\d{1,3})?$/.test(token))throw new Error(`Chrono invalide : « ${token} ». Exemple : 25,4 - 25.8 / 26 ; 1:02,5.`);
  const parts=token.replace(',','.').split(':'),seconds=parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(parts[0]);
  if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw new Error('Chaque chrono doit être positif et inférieur ou égal à 24 heures.');
  return seconds;
 });
}
