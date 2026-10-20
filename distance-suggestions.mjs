import {distances as referenceDistances,predictReference} from './core.mjs';

// Read common running notation, not arbitrary arithmetic. Times, percentages,
// recoveries, totals and equipment spacing must not become race distances.
export function sessionDistancePlan(value) {
 const original=String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const text=original.replace(/[×x]/g,'*').replace(/[–—]/g,'-')
  .replace(/\b\d+(?:[.,]\d+)?\s*(?:%|['′"″](?:\s*\d+)?|min(?:utes?)?\b|s(?:ec(?:ondes?)?)?\b)/g,' ')
  .replace(/\b(?:r|recup(?:eration)?)[ \t]*[:=]?[ \t]*\d+(?:[.,]\d+)?[ \t]*(?:km|m(?:etres?)?\b)?/g,' ')
  .split('\n').filter(line=>!/(?:relais|transmission|lattes?|espacement)/.test(line)).join('\n');
 const valid=d=>Number.isFinite(d)&&d>=30&&d<=1500;
 const sequence=node=>node?.values||(valid(node?.number)?[node.number]:null);
 let pos=0;
 const spaces=()=>{while(/\s/.test(text[pos]||'!'))pos++;};
 function factor(depth){
  spaces();if(depth>6)return null;
  if(text[pos]==='('){pos++;const node=expression(depth+1);spaces();if(text[pos]!==')')return null;pos++;return node;}
  const match=/^(\d+(?:[.,]\d+)?)\s*(km\b|m(?:etres?)?\b)?/.exec(text.slice(pos));
  if(!match)return null;pos+=match[0].length;
  return {number:Number(match[1].replace(',','.'))*(match[2]==='km'?1000:1),explicit:!!match[2]};
 }
 function term(depth){
  let left=factor(depth);if(!left)return null;
  spaces();while(text[pos]==='*'){
   pos++;const right=factor(depth);if(!right||left.values||!Number.isInteger(left.number)||left.number<1||left.number>200)return null;
   if(!right.values&&!right.explicit&&right.number<30&&left.number*right.number<=200)left={number:left.number*right.number};
   else {const values=sequence(right);if(!values||values.length*left.number>200)return null;left={values:Array.from({length:left.number},()=>values).flat()};}
   spaces();
  }return left;
 }
 function expression(depth){
  let left=term(depth);if(!left)return null;
  spaces();while(['+','-','/'].includes(text[pos])){
   const before=pos;pos++;const right=term(depth),a=sequence(left),b=sequence(right);
   if(!right||!a||!b){pos=before;break;}
   if(a.length+b.length>200)return null;left={values:[...a,...b]};spaces();
  }return left;
 }
 const runs=[];
 while(pos<text.length){
  if(!/[\d(]/.test(text[pos])){pos++;continue;}
  const start=pos,node=expression(0);
  if(node?.values)runs.push(node.values);else if(node?.explicit&&valid(node.number))runs.push([node.number]);
  if(pos<=start)pos=start+1;
 }
 return {sequence:/\bou\b/.test(original)?[]:runs.flat().slice(0,200),candidates:[...new Set(runs.flat())]};
}

// Suggestions only: a missing pace is not a blocker. The selected workout's
// distances/order take priority over any statistical match to a personal PB.
export function suggestSessionDistances(session,times,references={},variant=1) {
 const workout=variant===2?session.v2:session.workout,plan=sessionDistancePlan(workout);
 const targets=variant===2?[]:(session.targets||[]).filter(t=>Number.isFinite(t.distance)&&t.distance>=50&&t.distance<=1500);
 const candidates=plan.candidates.length?plan.candidates:targets.length?[...new Set(targets.map(t=>t.distance))]:[...new Set([...referenceDistances,120])];
 const percentages=[...String(workout||'').matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map(m=>Number(m[1].replace(',','.'))).filter(p=>p>0&&p<=100);
 const uniquePercent=[...new Set(percentages)],statedPercent=uniquePercent.length===1?uniquePercent[0]:null;
 const usualPercent={speed:92,hills:85,endurance:80,vo2:70,competition:100,group:85}[session.type]||85;
 return times.map((time,index)=>{
  if(!Number.isFinite(time)||time<=0)return null;
  if(plan.sequence.length>=times.length)return {distance:plan.sequence[index],source:'Consigne '+(variant===2?'V2':'V1')};
  if(candidates.length===1)return {distance:candidates[0],source:'Distance de la séance'};
  const ranked=candidates.map(distance=>{
   const reference=predictReference(references,distance);
   const matching=targets.filter(t=>t.distance===distance);
   let expected=reference?reference.time/((statedPercent||usualPercent)/100):null;
   const targetTimes=matching.map(t=>t.kind==='range'&&t.minTime>0&&t.maxTime>=t.minTime?(t.minTime+t.maxTime)/2:reference&&t.percent>0&&t.percent<=150?reference.time/(t.percent/100):null).filter(t=>t!==null);
   if(targetTimes.length)expected=targetTimes.reduce((best,t)=>Math.abs(Math.log(time/t))<Math.abs(Math.log(time/best))?t:best);
   if(!expected)return null;
   const score=Math.abs(Math.log(time/expected));
   return {distance,score,source:!reference?'Temps cible du coach':targetTimes.length||statedPercent?'Estimation selon vos références et l’allure':'Estimation selon vos références · à vérifier'};
  }).filter(Boolean).sort((a,b)=>a.score-b.score);
  if(!ranked.length||ranked[0].score>Math.log(1.35)||ranked[1]&&ranked[1].score-ranked[0].score<.06)return null;
  const {distance,source}=ranked[0];return {distance,source};
 });
}

// A saved row, including an explicitly blank distance, is never recalculated.
// Manual corrections/clears stay locked for this editor, including V1/V2 changes.
export function updateDistanceDraft(draft,suggestions,locked=new Set()) {
 suggestions.forEach((suggestion,index)=>{if(!locked.has(index))draft[index]=suggestion?.distance??null;});
 return draft;
}
