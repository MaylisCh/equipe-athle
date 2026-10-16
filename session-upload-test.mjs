import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrainingFile,nextWeekStartParis} from './session-upload.mjs';

const parseCsv=(content,now='2026-10-06T10:00:00Z')=>parseTrainingFile(new File([content],'planning.csv'),{now:new Date(now)});

test('sépare les conditions du titre et garde un type correspondant à la séance',async()=>{
 const {days}=await parseCsv('Date,Séance\n2026-10-12,Vitesse/technique si stage\n2026-10-13,Repos ou muscu si compétition\n');
 assert.deepEqual(days.map(({title,subtitle,type})=>({title,subtitle,type})),[
  {title:'Vitesse/technique',subtitle:'Si stage',type:'speed'},
  {title:'Muscu',subtitle:'Si compétition',type:'strength'}
 ]);
});

test('les cellules vides et Repos sont des jours vides, sans supprimer les dates passées du fichier',async()=>{
 const {days}=await parseCsv('Date,Séance\n2026-10-05,Footing\n2026-10-12,Repos\n2026-10-13,\n');
 assert.equal(days.length,3);
 assert.deepEqual(days.map(day=>day.rest),[false,true,true]);
 assert.equal(days[0].date,'2026-10-05');
});

test('reconnaît un échauffement séparé et les dates de démarrage de la semaine prochaine à Paris',async()=>{
 const {days}=await parseCsv('Date,Séance\n2026-10-12,"Vitesse\nÉchauffement: 15 min footing"');
 assert.equal(days[0].title,'Vitesse');
 assert.equal(days[0].warmup,'15 min footing');
 assert.equal(days[0].workout,'Vitesse');
 assert.equal(nextWeekStartParis(new Date('2026-10-06T10:00:00Z')),'2026-10-12');
 assert.equal(nextWeekStartParis(new Date('2026-10-12T10:00:00Z')),'2026-10-19');
});
