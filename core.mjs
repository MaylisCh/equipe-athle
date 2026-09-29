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
export function formatTime(value) {
 if(value==null)return '—';
 const rounded=Math.round(value*100);
 return rounded<6000 ? (rounded/100).toFixed(2).replace('.',',')+' s' : `${Math.floor(rounded/6000)}:${((rounded%6000)/100).toFixed(2).padStart(5,'0').replace('.',',')}`;
}
export const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const fromKey = key => new Date(`${key}T12:00:00`);
