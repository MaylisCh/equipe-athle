import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import { parseTime, targetTime, formatTime } from './core.mjs';

test('Chronos : formats, pourcentages, bornes et arrondi minute',()=>{
 assert.equal(parseTime('24,50'),24.5);assert.equal(parseTime('1:02,50'),62.5);
 assert.equal(parseTime(''),null);assert.throws(()=>parseTime('0'));assert.throws(()=>parseTime('-8'));assert.throws(()=>parseTime('1:70'));
 assert.equal(targetTime(24,80),30);assert.equal(targetTime(54,90),60);assert.equal(targetTime(24,0),null);
 assert.equal(formatTime(59.999),'1:00,00');
});

test('Activation du premier admin en production avec code secret',async t=>{
 const data=mkdtempSync(join(tmpdir(),'athle-prod-test-'));
 const port=18789,origin=`https://localhost:${port}`,base=`http://localhost:${port}`;
 let processHandle,logs='';
 processHandle=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,NODE_ENV:'production',ADMIN_SETUP_SECRET:'code-secret-render',ATHLE_DATA_DIR:data,PORT:String(port),APP_ORIGIN:origin,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 processHandle.stdout.on('data',d=>logs+=d);processHandle.stderr.on('data',d=>logs+=d);
 t.after(async()=>{if(processHandle.exitCode===null){const exited=once(processHandle,'exit');processHandle.kill('SIGTERM');await exited;}});
 for(let i=0;i<100;i++){try{await fetch(base+'/api/auth');break;}catch{await delay(50);}}
 const auth=await (await fetch(base+'/api/auth')).json();
 assert.equal(auth.setup,true);assert.equal(auth.setupCodeRequired,true);
 const headers={Origin:origin,'Content-Type':'application/json'};
 let response=await fetch(base+'/api/setup',{method:'POST',headers,body:JSON.stringify({email:'maylis',name:'Maylis',lastName:'Chancerelle',password:'Une phrase de test 2026!',setupCode:'mauvais-code'})});
 assert.equal(response.status,403);
 response=await fetch(base+'/api/setup',{method:'POST',headers,body:JSON.stringify({email:'maylis',name:'Maylis',lastName:'Chancerelle',password:'Une phrase de test 2026!',setupCode:'code-secret-render'})});
 assert.equal(response.status,201,logs);
 assert.equal((await response.json()).user.role,'admin');
});

test('Comptes indépendants, droits, invitations, éditions, échanges, conflits et persistance',async t=>{
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
 const credentials=(email)=>({email,name:email,password:'Une phrase de test 2026!'});
 let result=await request('/state');assert.equal(result.status,401);
 const owner=(await request('/setup','POST',{...credentials('maylis'),name:'Maylis',lastName:'Chancerelle'})).json;assert.equal(owner.user.role,'admin');
 assert.equal((await request('/setup','POST',credentials('intrus'))).status,403);
 let token=(await request('/invitations','POST',{},owner)).json.token;
 const admin=(await request('/register','POST',{...credentials('coach'),invite:token,coach:true})).json;assert.equal(admin.user.role,'coach');
 assert.equal((await request('/register','POST',{...credentials('pirate'),invite:token,coach:true})).status,403);
 assert.equal((await request('/register','POST',{...credentials('pirate'),invite:'invented-code',coach:true})).status,403);
 const alice=(await request('/register','POST',{...credentials('alice'),coach:false,role:'admin'})).json;
 assert.equal(alice.user.role,'athlete');
 const bob=(await request('/register','POST',credentials('bob'))).json;
 token=(await request('/invitations','POST',{coach:true},owner)).json.token;
 const coach2=(await request('/register','POST',{...credentials('coach2'),invite:token,coach:true})).json;assert.equal(coach2.user.role,'coach');
 assert.equal((await request('/invitations','POST',{},alice)).status,403);
 assert.equal((await request('/invitations','POST',{},admin)).status,403);
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
 assert.equal((await request('/account','PUT',{name:'Alice',lastName:'Martin',phone:'0600000000',version:1},alice)).status,200);
 assert.equal((await request('/account','PUT',{name:'Pirate',role:'coach',version:2},alice)).status,403);
 const directory=(await request('/state','GET',undefined,bob)).json.members;
 assert.equal(directory.find(m=>m.id===alice.user.id).phone,'0600000000');assert.equal(directory.some(m=>'email' in m||'profile' in m),false);
 assert.equal((await request('/state','GET',undefined,owner)).json.user.name,'Maylis');
 assert.equal((await request('/sessions','POST',{...base,date:'2026-02-30'},admin)).status,400);
 const morning=(await request('/sessions','POST',base,admin)).json;
 const afternoon=(await request('/sessions','POST',{...base,title:'Musculation PM',type:'strength',slot:'apres-midi'},admin)).json;
 let shared=(await request('/state','GET',undefined,bob)).json;
 assert.equal(shared.sessions.filter(s=>s.date==='2026-10-02'&&s.type!=='rest').length,2);
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
 const badOrigin=await fetch(origin+'/api/invitations',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json',Authorization:`Bearer ${admin.accessToken}`,'X-CSRF-Token':admin.csrf},body:'{}'});assert.equal(badOrigin.status,403);
 const noCSRF=await fetch(origin+'/api/invitations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:`Bearer ${admin.accessToken}`},body:'{}'});assert.equal(noCSRF.status,403);
 assert.equal((await fetch(origin+'/data/athle.sqlite')).status,404);assert.equal((await fetch(origin+'/content.mjs')).status,404);assert.equal((await fetch(origin+'/seed.json')).status,404);
 assert.equal((await request('/auth')).json.user,null,'Une nouvelle ouverture sans jeton doit demander la connexion.');
 await request('/logout','POST',{},alice);assert.equal((await request('/state','GET',undefined,alice)).status,401);
 await stop();await start();
 const relogged=(await request('/login','POST',credentials('alice'))).json;
 const restored=(await request('/state','GET',undefined,relogged)).json;
 assert.deepEqual(restored.profile.times,{200:24,400:54});assert.equal(restored.sessions.find(s=>s.id===morning.id).date,'2026-10-04');
 const ownPath='/members/'+owner.user.id+'/admin',bobPath='/members/'+bob.user.id+'/admin';
 assert.equal((await request(bobPath,'PUT',{action:'grant-admin',expectedRole:'athlete'},admin)).status,403);
 assert.equal((await request(ownPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},owner)).status,409,'Impossible de retirer le dernier admin');
 assert.equal((await request(bobPath,'PUT',{action:'grant-admin',expectedRole:'athlete'},owner)).status,200);
 assert.equal((await request('/invitations','POST',{},bob)).status,200,'Le nouvel admin peut inviter un coach sans changer de compte');
 assert.equal((await request(ownPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},owner)).status,200);
 assert.equal((await request('/invitations','POST',{},owner)).status,403,'Les anciens droits cessent immédiatement');
 assert.equal((await request(bobPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},bob)).status,409);
 const coachPath='/members/'+admin.user.id+'/admin';
 assert.equal((await request(coachPath,'PUT',{action:'grant-admin',expectedRole:'coach'},bob)).status,200);
 assert.equal((await request(coachPath,'PUT',{action:'revoke-admin',expectedRole:'admin'},bob)).json.role,'coach','Restitution du rôle coach précédent');
 const deletion={password:credentials('alice').password,confirm:true};
 assert.equal((await request('/account','DELETE',deletion,bob)).status,409,'Le dernier admin ne peut pas supprimer son compte');
 assert.equal((await request('/account','DELETE',{...deletion,confirm:false},relogged)).status,400);
 assert.equal((await request('/account','DELETE',{...deletion,password:'faux mot de passe'},relogged)).status,403);
 assert.equal((await request('/account','DELETE',{...deletion,id:bob.user.id},relogged)).status,200,'La cible est toujours le compte connecté');
 assert.equal((await request('/state','GET',undefined,relogged)).status,401);
 const afterDeletion=(await request('/state','GET',undefined,bob)).json;
 assert.equal(afterDeletion.members.some(m=>m.id===alice.user.id),false);
 assert.equal(afterDeletion.members.some(m=>m.id===bob.user.id),true);
 assert.equal(afterDeletion.sessions.some(s=>s.id===morning.id),true);
 assert.equal((await request('/login','POST',credentials('alice'))).status,401);
});
