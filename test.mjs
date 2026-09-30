import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { parseTime, targetTime, predictReference, trainingTarget, equivalentIntensity, weeklyLoadForDate, sessionLoad, formatTime } from './core.mjs';

test('Chronos : formats, pourcentages, bornes et arrondi minute',()=>{
 assert.equal(parseTime('24,50'),24.5);assert.equal(parseTime('1:02,50'),62.5);
 assert.equal(parseTime(''),null);assert.throws(()=>parseTime('0'));assert.throws(()=>parseTime('-8'));assert.throws(()=>parseTime('1:70'));
 assert.equal(targetTime(24,80),30);assert.equal(targetTime(54,90),60);assert.equal(targetTime(24,0),null);
 assert.equal(formatTime(59.999),'1:00,00');
});

test('Courbe personnelle : chronos exacts, fatigue et tableaux corrigés du coach',()=>{
 const times={100:12,200:24,400:54};
 for(const [distance,time] of Object.entries(times))assert.equal(predictReference(times,Number(distance)).time,time);
 const p250=predictReference(times,250);
 assert.equal(p250.kind,'interpolé');assert.deepEqual(p250.anchors,[200,400]);
 assert.ok(p250.time>30&&p250.time<32,'La fatigue augmente le temps du 250 m par rapport au prorata du 200 m.');
 const target=trainingTarget(times,250,85);
 assert.ok(Math.abs(target.targetTime-250/target.targetSpeed)<1e-10);
 assert.ok(Math.abs(trainingTarget({500:63},500,85).targetTime-63/.85)<1e-10,'Le 500 m à 85 % ne reprend pas le bloc erroné à 80 %.');
 assert.ok(Math.abs(trainingTarget({250:28},250,89).targetTime-28/.89)<1e-10,'Le 250 m à 89 % suit les formules plutôt que l’en-tête erroné.');
 assert.equal(predictReference({200:24},100).kind,'extrapolé');
 assert.equal(predictReference({},250),null);assert.equal(predictReference(times,30),null);
});

test('Plages fixes et charge hebdomadaire distincte de la charge de séance',()=>{
 const intensity=equivalentIntensity({400:80},400,90,95);
 assert.ok(Math.abs(intensity.min-80/95*100)<1e-10);
 assert.ok(Math.abs(intensity.max-80/90*100)<1e-10);
 assert.equal(equivalentIntensity({},400,90,95),null);
 assert.equal(equivalentIntensity({400:80},400,95,90),null);
 assert.equal(weeklyLoadForDate('2026-09-28'),'medium');
 assert.deepEqual(sessionLoad({date:'2026-09-28'}),{level:'medium',source:'week'});
 assert.deepEqual(sessionLoad({date:'2026-09-28',load:'high'}),{level:'high',source:'session'});
 assert.equal(sessionLoad({date:'2026-09-28',load:'none'}),null);
 assert.equal(weeklyLoadForDate('2028-08-01'),null);
});

test('Activation du premier admin en production par identifiant',async t=>{
 const data=mkdtempSync(join(tmpdir(),'athle-prod-test-'));
 const port=18789,origin=`https://localhost:${port}`,base=`http://localhost:${port}`;
 let processHandle,logs='';
 processHandle=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,NODE_ENV:'production',ATHLE_DATA_DIR:data,PORT:String(port),APP_ORIGIN:origin,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 processHandle.stdout.on('data',d=>logs+=d);processHandle.stderr.on('data',d=>logs+=d);
 t.after(async()=>{if(processHandle.exitCode===null){const exited=once(processHandle,'exit');processHandle.kill('SIGTERM');await exited;}});
 for(let i=0;i<100;i++){try{await fetch(base+'/api/auth');break;}catch{await delay(50);}}
 const auth=await (await fetch(base+'/api/auth')).json();
 assert.equal(auth.setup,true);assert.equal(auth.setupCodeRequired,false);
 const headers={Origin:origin,'Content-Type':'application/json'};
 const response=await fetch(base+'/api/setup',{method:'POST',headers,body:JSON.stringify({email:'maylis',name:'Maylis',lastName:'Chancerelle'})});
 assert.equal(response.status,201,logs);
 assert.equal((await response.json()).user.role,'admin');
});

test('Comptes indépendants, droits, éditions, échanges, conflits et persistance',async t=>{
 const data=mkdtempSync(join(tmpdir(),'athle-test-'));
 const port=18787,origin=`http://localhost:${port}`;
 let processHandle,logs='';
 async function start(){
  processHandle=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,ATHLE_DATA_DIR:data,PORT:String(port),APP_ORIGIN:origin,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  processHandle.stdout.on('data',d=>logs+=d);processHandle.stderr.on('data',d=>logs+=d);
  for(let i=0;i<100;i++){try{await fetch(origin+'/api/auth');return;}catch{}await delay(50);}
  throw new Error(logs);
 }
 async function stop(){if(processHandle.exitCode===null){const exited=once(processHandle,'exit');processHandle.kill('SIGTERM');await exited;}}
 t.after(stop);await start();
 async function request(path,method='GET',body,session){
  const response=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.accessToken}`,'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json();return {status:response.status,json};
 }
 const credentials=(email)=>({email,name:email});
 let result=await request('/state');assert.equal(result.status,401);
 const owner=(await request('/setup','POST',{...credentials('maylis'),name:'Maylis',lastName:'Chancerelle'})).json;assert.equal(owner.user.role,'admin');
 assert.equal((await request('/setup','POST',credentials('intrus'))).status,403);
 const admin=(await request('/register','POST',{...credentials('coach'),coach:true})).json;assert.equal(admin.user.role,'coach');
 const alice=(await request('/register','POST',{...credentials('alice'),coach:false,role:'admin'})).json;
 assert.equal(alice.user.role,'athlete');
 const duplicateRegistration=await request('/register','POST',credentials('ALICE'));
 assert.equal(duplicateRegistration.status,409);
 assert.match(duplicateRegistration.json.error,/déjà utilisé/);
 const bob=(await request('/register','POST',credentials('bob'))).json;
 const coach2=(await request('/register','POST',{...credentials('coach2'),coach:true})).json;assert.equal(coach2.user.role,'coach');
 assert.equal((await request('/invitations','POST',{},admin)).status,404);
 let original=(await request('/state','GET',undefined,admin)).json;
 assert.equal(original.sessions.length,101);assert.equal(original.info.length,12);assert.equal(original.library.length,11);
 assert.equal(original.sessions.find(s=>s.date==='2026-09-29').v2.length>0,true);
 assert.equal((await request('/profile','PUT',{times:{200:24,400:54},version:1},alice)).status,200);
 assert.equal((await request('/profile','PUT',{times:{200:28},version:1},admin)).status,200);
 const aliceState=(await request('/state','GET',undefined,alice)).json;
 assert.deepEqual(aliceState.profile.times,{200:24,400:54});
 assert.deepEqual((await request('/state','GET',undefined,bob)).json.profile,{});
 assert.deepEqual((await request('/state','GET',undefined,admin)).json.profile.times,{200:28});
 assert.equal((await request('/profile','PUT',{times:{200:-1},version:2},alice)).status,400);
 assert.equal((await request('/profile','PUT',{times:{200:25},version:1},alice)).status,409);
 assert.equal(aliceState.sessions.some(s=>'coachNote' in s),false);
 const base={title:'Séance de test',type:'speed',date:'2026-10-02',slot:'matin',warmup:'Mobilité',workout:'Tests',v2:'Variante',targets:[{distance:200,percent:80}]};
 assert.equal((await request('/sessions','POST',base,alice)).status,403);
 assert.equal((await request('/sessions','POST',base,owner)).status,403);
 assert.equal((await request('/account','PUT',{email:'alice',name:'Alice',lastName:'Martin',phone:'0600000000',version:1},alice)).status,200);
 assert.equal((await request('/account','PUT',{email:'alice',name:'Pirate',role:'coach',version:2},alice)).status,403);
 const directory=(await request('/state','GET',undefined,bob)).json.members;
 assert.equal(directory.find(m=>m.id===alice.user.id).phone,'0600000000');assert.equal(directory.some(m=>'email' in m||'profile' in m),false);
 assert.equal((await request('/state','GET',undefined,owner)).json.user.name,'Maylis');
 assert.equal((await request('/sessions','POST',{...base,date:'2026-02-30'},admin)).status,400);
 const morning=(await request('/sessions','POST',base,admin)).json;
 const ranged={...base,title:'400 m filles et garçons',load:'high',targets:[{distance:400,kind:'range',label:'Filles',minTime:90,maxTime:95},{distance:400,kind:'range',label:'Garçons',minTime:70,maxTime:80},{distance:200,kind:'percent',percent:80,label:'Tous'}]};
 assert.equal((await request('/sessions','POST',{...ranged,targets:[{distance:400,kind:'range',minTime:95,maxTime:90}]},admin)).status,400);
 const rangedCreated=(await request('/sessions','POST',ranged,admin)).json;
 assert.equal(rangedCreated.load,'high');
 const rangedState=(await request('/state','GET',undefined,alice)).json.sessions.find(s=>s.id===rangedCreated.id);
 assert.equal(rangedState.targets[0].minTime,90);
 assert.equal(rangedState.targets[1].label,'Garçons');
 const afternoon=(await request('/sessions','POST',{...base,title:'Musculation PM',type:'strength',slot:'apres-midi'},admin)).json;
 let shared=(await request('/state','GET',undefined,bob)).json;
 assert.equal(shared.sessions.filter(s=>s.date==='2026-10-02'&&s.type!=='rest').length,3);
 const speed=original.sessions.find(s=>s.date==='2026-09-28'),strength=original.sessions.find(s=>s.date==='2026-09-30');
 assert.equal((await request('/sessions/'+encodeURIComponent(speed.id),'PUT',{...speed,date:strength.date,swapId:strength.id,swapVersion:strength.version},admin)).status,200);
 shared=(await request('/state','GET',undefined,alice)).json;
 assert.equal(shared.sessions.find(s=>s.id===speed.id).date,strength.date);
 assert.equal(shared.sessions.find(s=>s.id===strength.id).date,speed.date);
 assert.equal(shared.sessions.find(s=>s.id===speed.id).workout,speed.workout);
 assert.equal((await request('/sessions/'+encodeURIComponent(speed.id),'PUT',speed,coach2)).status,409);
 assert.equal((await request('/sessions/'+morning.id,'DELETE',{version:1},alice)).status,403);
 assert.equal((await request('/sessions/'+morning.id,'PUT',{...morning,date:'2026-10-04'},admin)).status,200);
 assert.equal((await request('/sessions/'+afternoon.id,'DELETE',{version:1},admin)).status,200);
 for(const collection of ['library','info']){
  const item={title:'Texte <script> inoffensif',body:'Contenu partagé',category:collection==='library'?'acronym':'organisation',icon:'☀️'};
  assert.equal((await request('/'+collection,'POST',item,alice)).status,403);
  const created=(await request('/'+collection,'POST',item,admin)).json;
  assert.equal((await request('/'+collection+'/'+created.id,'PUT',{...created,body:'Texte modifié'},admin)).status,200);
  const state=(await request('/state','GET',undefined,bob)).json;
  assert.equal(state[collection].find(s=>s.id===created.id).body,'Texte modifié');
 }
 const badOrigin=await fetch(origin+'/api/sessions',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json',Authorization:`Bearer ${admin.accessToken}`,'X-CSRF-Token':admin.csrf},body:'{}'});assert.equal(badOrigin.status,403);
 const noCSRF=await fetch(origin+'/api/sessions',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:`Bearer ${admin.accessToken}`},body:'{}'});assert.equal(noCSRF.status,403);
 assert.equal((await fetch(origin+'/data/athle.sqlite')).status,404);assert.equal((await fetch(origin+'/content.mjs')).status,404);assert.equal((await fetch(origin+'/seed.json')).status,404);
 assert.equal((await request('/auth')).json.user,null,'Une nouvelle ouverture sans jeton doit demander la connexion.');
 await request('/logout','POST',{},alice);assert.equal((await request('/state','GET',undefined,alice)).status,401);
 await stop();await start();
 const relogged=(await request('/login','POST',credentials('alice'))).json;
 const restored=(await request('/state','GET',undefined,relogged)).json;
 assert.deepEqual(restored.profile.times,{200:24,400:54});assert.equal(restored.sessions.find(s=>s.id===morning.id).date,'2026-10-04');
 const collision=await request('/account','PUT',{email:'BOB',name:'Alice',lastName:'Martin',version:restored.user.accountVersion},relogged);
 assert.equal(collision.status,409);assert.match(collision.json.error,/déjà utilisé/);
 assert.equal((await request('/state','GET',undefined,relogged)).json.user.email,'alice','Une collision ne change pas le compte.');
 assert.equal((await request('/account','PUT',{email:'  ALICE-NOUVELLE  ',name:'Alice',lastName:'Martin',version:restored.user.accountVersion},relogged)).status,200);
 const renamed=(await request('/state','GET',undefined,relogged)).json;
 assert.equal(renamed.user.email,'alice-nouvelle');assert.equal(renamed.user.id,alice.user.id);
 assert.deepEqual(renamed.profile.times,{200:24,400:54});
 assert.equal((await request('/login','POST',credentials('alice'))).status,401);
 assert.equal((await request('/login','POST',credentials('ALICE-NOUVELLE'))).status,200);
 const ownPath='/members/'+owner.user.id+'/admin',bobPath='/members/'+bob.user.id+'/admin';
 assert.equal((await request(bobPath,'PUT',{action:'grant-admin',expectedRole:'athlete'},admin)).status,403);
 assert.equal((await request(ownPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},owner)).status,409,'Impossible de retirer le dernier admin');
 assert.equal((await request(bobPath,'PUT',{action:'grant-admin',expectedRole:'athlete'},owner)).status,200);
 assert.equal((await request(ownPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},owner)).status,200);
 assert.equal((await request(bobPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},owner)).status,403,'Les anciens droits cessent immédiatement');
 assert.equal((await request(bobPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},bob)).status,409);
 const coachPath='/members/'+admin.user.id+'/admin';
 assert.equal((await request(coachPath,'PUT',{action:'grant-admin',expectedRole:'coach'},bob)).status,200);
 assert.equal((await request(coachPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},bob)).json.role,'coach','Restitution du rôle coach précédent');
 const deletion={identifier:'alice-nouvelle',confirm:true};
 assert.equal((await request('/account','DELETE',deletion,bob)).status,403,'Un autre identifiant ne peut pas confirmer ce profil');
 assert.equal((await request('/account','DELETE',{...deletion,confirm:false},relogged)).status,400);
 assert.equal((await request('/account','DELETE',{...deletion,identifier:'mauvais-identifiant'},relogged)).status,403);
 assert.equal((await request('/account','DELETE',deletion,relogged)).status,200,'La cible est toujours le compte connecté');
 assert.equal((await request('/state','GET',undefined,relogged)).status,401);
 const afterDeletion=(await request('/state','GET',undefined,bob)).json;
 assert.equal(afterDeletion.members.some(m=>m.id===alice.user.id),false);
 assert.equal(afterDeletion.members.some(m=>m.id===bob.user.id),true);
 assert.equal(afterDeletion.sessions.some(s=>s.id===morning.id),true);
 assert.equal((await request('/login','POST',credentials('alice'))).status,401);
 assert.equal((await request('/login','POST',credentials('alice-nouvelle'))).status,401);
});
