export const distances = [50,60,80,100,125,150,200,250,300,400,500,600,800,1000,1500];
export const types = {
 speed:'Vitesse / technique', strength:'Musculation', vo2:'VO₂ max',
 endurance:'Endurance', hills:'Côtes', competition:'Compétition', group:'Collectif', rest:'Repos'
};
export function parseTime(input) {
 const value=String(input).trim().replace(',', '.');
 if(!value)return null;
 let result;
 if(/^\d+(?:\.\d{1,3})?$/.test(value)) result=Number(value);
 else if(/^\d+:[0-5]?\d(?:\.\d{1,3})?$/.test(value)) {
  const [minutes,seconds]=value.split(':').map(Number);result=minutes*60+seconds;
 } else throw new Error('Utilisez des secondes (54,32) ou minutes:secondes (1:02,50).');
 if(!Number.isFinite(result)||result<=0||result>86400)throw new Error('Le chrono doit être supérieur à zéro.');
 return result;
}
export function targetTime(reference,percent) {
 if(!Number.isFinite(reference)||reference<=0||!Number.isFinite(percent)||percent<=0||percent>150)return null;
 return reference/(percent/100);
}
// Profil de fatigue de secours. Les rapports de vitesse entre distances
// voisines viennent des médianes KsA (100–1500 m) ; sous 100 m, 0,90 est une
// hypothèse prudente pour tenir compte de l'accélération initiale.
const fatigueBreaks=[50,100,200,400,800,1500];
const fatigueKsA=[null,0.992446,0.912,0.887940,0.921097];
const fatigueLogTimes=[-0.90*Math.log(2),0];
for(let i=2;i<fatigueBreaks.length;i++) {
 fatigueLogTimes[i]=fatigueLogTimes[i-1]+Math.log(fatigueBreaks[i]/fatigueBreaks[i-1]/fatigueKsA[i-1]);
}
function defaultLogTime(distance) {
 if(!Number.isFinite(distance)||distance<50||distance>1500)return null;
 const right=fatigueBreaks.findIndex(d=>d>=distance);
 if(fatigueBreaks[right]===distance)return fatigueLogTimes[right];
 const left=right-1, exponent=(fatigueLogTimes[right]-fatigueLogTimes[left])/Math.log(fatigueBreaks[right]/fatigueBreaks[left]);
 return fatigueLogTimes[left]+exponent*Math.log(distance/fatigueBreaks[left]);
}
export function predictReference(times,distance) {
 const base=defaultLogTime(distance);
 if(base===null)return null;
 const known=Object.entries(times||{}).map(([d,time])=>({distance:Number(d),time:Number(time)}))
  .filter(x=>defaultLogTime(x.distance)!==null&&Number.isFinite(x.time)&&x.time>0)
  .sort((a,b)=>a.distance-b.distance);
 if(!known.length)return null;
 const direct=known.find(x=>x.distance===distance);
 if(direct)return {time:direct.time,kind:'mesuré',anchors:[distance]};
 const right=known.findIndex(x=>x.distance>distance);
 const lower=right===-1?known.at(-1):right===0?known[0]:known[right-1];
 const upper=right>0?known[right]:lower;
 const correction=x=>Math.log(x.time)-defaultLogTime(x.distance);
 let residual=correction(lower);
 if(lower!==upper) {
  const fraction=Math.log(distance/lower.distance)/Math.log(upper.distance/lower.distance);
  residual+=(correction(upper)-residual)*fraction;
 }
 return {time:Math.exp(base+residual),kind:right>0?'interpolé':'extrapolé',anchors:lower===upper?[lower.distance]:[lower.distance,upper.distance]};
}
export function trainingTarget(times,distance,percent) {
 if(!Number.isFinite(percent)||percent<=0||percent>150)return null;
 const reference=predictReference(times,distance);
 if(!reference)return null;
 const referenceSpeed=distance/reference.time;
 const targetSpeed=referenceSpeed*percent/100;
 return {...reference,referenceSpeed,targetSpeed,targetTime:distance/targetSpeed};
}
export const formatSpeed = value => value==null?'—':`${value.toFixed(2).replace('.',',')} m/s`;
export function formatTime(value) {
 if(value==null)return '—';
 const rounded=Math.round(value*100);
 return rounded<6000 ? (rounded/100).toFixed(2).replace('.',',')+' s' : `${Math.floor(rounded/6000)}:${((rounded%6000)/100).toFixed(2).padStart(5,'0').replace('.',',')}`;
}
export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const fromKey = key => new Date(`${key}T12:00:00`);
// Feuille « 20262027 » : les trois bandes colorées indiquent la charge
// de chaque semaine, pas celle des séances individuelles. S1 = 31/08/2026.
const weeklyLoads = ['light','medium','medium','light','medium','medium','high','light','medium','high','high','light','medium','high','high','light','high','light','light','light','light','light','light','light'];
export function weeklyLoadForDate(key) {
 const date=fromKey(key);
 if(!Number.isFinite(+date))return null;
 const start=fromKey('2026-08-31');
 const day=Math.round((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);
 return weeklyLoads[Math.floor(day/7)]||null;
}
export function sessionLoad(session) {
 if(session.load==='none')return null;
 if(['light','medium','high'].includes(session.load))return {level:session.load,source:'session'};
 const level=weeklyLoadForDate(session.date);
 return level?{level,source:'week'}:null;
}
export function equivalentIntensity(times,distance,minTime,maxTime) {
 if(!Number.isFinite(minTime)||!Number.isFinite(maxTime)||minTime<=0||maxTime<minTime)return null;
 const reference=predictReference(times,distance);
 return reference?{min:reference.time/maxTime*100,max:reference.time/minTime*100,reference}:null;
}
