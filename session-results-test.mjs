import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {sqliteD1} from './sqlite-d1.mjs';
import {parseSessionTimes,normalizeSessionDistances} from './session-results-core.mjs';
import {sessionDistancePlan,suggestSessionDistances,updateDistanceDraft} from './distance-suggestions.mjs';

test('Distances suggérées : consignes sans cible, séries mixtes et version choisie',()=>{
 const distances=(session,times,refs={},variant=1)=>suggestSessionDistances(session,times,refs,variant).map(s=>s?.distance??null);
 assert.deepEqual(sessionDistancePlan('(2×250 + 2×200) 80 %, r 1′30, R 6′\n(800)').sequence,[250,250,200,200]);
 assert.deepEqual(sessionDistancePlan('300-150-150 / 200-200 80% r1\'30').sequence,[300,150,150,200,200]);
 assert.deepEqual(sessionDistancePlan('2*(200+150)').sequence,[200,150,200,150]);
 assert.deepEqual(sessionDistancePlan('3*3*100m').sequence,Array(9).fill(100));
 assert.deepEqual(sessionDistancePlan('6*30"/30" R4\' (720)\nTravail latte 2m').candidates,[]);
 assert.deepEqual(distances({workout:'3 × 200 m'},[28,30,42]),[200,200,200],'No pace or personal reference is required when the coach gives a distance');
 assert.deepEqual(distances({workout:'200+300',v2:'2 × 150m'},[20,21],{},2),[150,150]);
 assert.deepEqual(distances({workout:'200 m ou 400 m'},[25],{200:24,400:54}),[200]);
 assert.deepEqual(distances({workout:'200 m ou 400 m'},[25]),[null],'Unordered alternatives require evidence');
 assert.deepEqual(distances({workout:'10*125m ou 2*5*125m'},[20,23]),[125,125]);
});

test('Distances suggérées : modèle personnel sans temps coach, cibles et prudence',()=>{
 const refs={100:12,200:24,400:54},session={type:'speed',workout:''};
 assert.equal(suggestSessionDistances(session,[26],refs)[0].distance,200);
 assert.equal(suggestSessionDistances(session,[35],refs)[0].distance,250);
 assert.equal(suggestSessionDistances(session,[55],refs)[0].distance,400);
 assert.equal(suggestSessionDistances(session,[26],{200:24})[0].distance,200,'A single reference can drive the fatigue model');
 assert.equal(suggestSessionDistances(session,[26],{200:30})[0].distance,150,'Suggestions use this member’s own references, not a group average');
 assert.deepEqual(suggestSessionDistances(session,[12],refs),[null],'Close candidates are not presented as reliable');
 assert.deepEqual(suggestSessionDistances(session,[26]),[null]);
 assert.deepEqual(suggestSessionDistances(session,[5000],refs),[null]);
 const ranges={workout:'',targets:[{distance:200,kind:'range',minTime:28,maxTime:30},{distance:400,kind:'range',minTime:65,maxTime:70}]};
 assert.equal(suggestSessionDistances(ranges,[29])[0].distance,200,'Fixed coach targets can be matched even without a personal PB');
 assert.deepEqual(suggestSessionDistances({...ranges,v2:'Séance différente'},[29],{},2),[null],'V1 targets must not leak into V2');
});

test('Distances suggérées : ne jamais écraser une valeur enregistrée ou corrigée',()=>{
 const draft=[400,null,null],locked=new Set([0,1]),suggestions=[{distance:200},{distance:200},{distance:150}];
 assert.deepEqual(updateDistanceDraft(draft,suggestions,locked),[400,null,150]);
 assert.deepEqual(updateDistanceDraft(draft,[null,null,{distance:250}],locked),[400,null,250]);
 locked.add(2);draft[2]=null;
 assert.deepEqual(updateDistanceDraft(draft,suggestions,locked),[400,null,null]);
});

test('Chronos séance : décimales, séparateurs, minutes et saisies invalides',()=>{
 assert.deepEqual(parseSessionTimes('25,4 - 25.8 / 26 / 1:02,5 - 27'),[25.4,25.8,26,62.5,27]);
 for(const value of ['', 'abc','1,2.3','0','1:70','1e3','<script>','; / -', '25;26','25 26','25\n26','1 / '.repeat(201)])assert.throws(()=>parseSessionTimes(value));
});

test('Distances facultatives : une valeur par répétition, contrôles et champs vides',()=>{
 assert.deepEqual(normalizeSessionDistances([200,null,150.5],3),[200,null,150.5]);
 assert.deepEqual(normalizeSessionDistances([null,null],2),[null,null]);
 for(const values of [[200],[0,null],[-200,null],['200',null],[Infinity,null],[100001,null],undefined])assert.throws(()=>normalizeSessionDistances(values,2));
});

test('Pages : admin + coach, confidentialité des résultats, modifications, déplacements et migrations',async t=>{
 const native=new DatabaseSync(':memory:'),DB=sqliteD1(native);t.after(()=>native.close());
 const code=readFileSync(new URL('./functions/api/[[path]].js',import.meta.url),'utf8').replace("import seed from '../../seed.json';",`const seed=${readFileSync(new URL('./seed.json',import.meta.url),'utf8')};`).replace(/from '\.\.\/\.\.\/([^']+)'/g,(_,path)=>`from '${new URL(path,import.meta.url).href}'`);
 const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const request=async(path,method='GET',body,who)=>{
  const response=await onRequest({env:{DB},request:new Request('https://equipe.test/api'+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who.accessToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})});return {status:response.status,json:await response.json()};
 };
 await request('/auth');
 const owner=(await request('/setup','POST',{email:'maylis',name:'Maylis',password:'x'})).json;
 assert.ok(owner.accessToken);
 const register=async(email,coach=false)=>(await request('/register','POST',{email,name:email,password:'x',coach,groupCode:'NOUVEAU',coachCode:'COACH'})).json;
 const alice=await register('Alice'),bob=await register('Bob'),coach=await register('Coach',true);
 const state=async who=>(await request('/state','GET',undefined,who)).json;
 const s1=(await request('/sessions','POST',{title:'Matin',date:'2026-10-16',type:'speed',slot:'matin',warmup:'Échauffement A',workout:'3 × 200',v2:'2 × 200',targets:[]},coach)).json;
 const s2=(await request('/sessions','POST',{title:'Soir',date:'2026-10-16',type:'endurance',slot:'soir',targets:[]},coach)).json;
 const path='/sessions/'+s1.id+'/times';
 assert.equal((await request(path,'PUT',{rawText:'25,4 / 26',version:0,userId:bob.user.id},alice)).status,200);
 native.prepare('DELETE FROM session_result_variants WHERE session_id=? AND user_id=?').run(s1.id,alice.user.id);
 assert.equal((await state(alice)).sessionResults[0].sessionVariant,1,'Older results default to V1 without overwriting them');
 for(const sessionVariant of [0,3,'2',null])assert.equal((await request(path,'PUT',{rawText:'25 / 26',sessionVariant,version:1},alice)).status,400);
 assert.equal((await request('/sessions/'+s2.id+'/times','PUT',{rawText:'30',sessionVariant:2,version:0},alice)).status,400,'V2 requires a coach-provided variant');
 native.prepare('UPDATE session_results SET raw_text=? WHERE session_id=? AND user_id=?').run('25,4 ; 26',s1.id,alice.user.id);
 assert.deepEqual((await state(alice)).sessionResults[0].times,[25.4,26],'Older separator formats stay readable without migrating stored data');
 assert.deepEqual((await state(alice)).sessionResults[0].distances,[null,null]);
 assert.equal((await request(path,'PUT',{rawText:'27 - 28',version:0},bob)).status,200);
 assert.equal((await request('/sessions/'+s2.id+'/times','PUT',{rawText:'30',version:0},alice)).status,200);
 assert.equal((await state(alice)).sessionResults.length,2);assert.ok((await state(alice)).sessionResults.every(r=>r.userId===alice.user.id));
 assert.equal((await state(bob)).sessionResults.length,1);assert.equal((await state(coach)).sessionResults.length,3);
 assert.equal((await state(owner)).sessionResults.length,0,'Admin without coach powers cannot read group times');
 assert.equal((await request('/sessions/'+s1.id+'/comment','PUT',{rating:3,body:'Privé coach',isPrivate:true,version:0},alice)).status,200);
 assert.equal((await state(owner)).comments.some(c=>c.body==='Privé coach'),false);
 assert.equal((await request(path,'PUT',{rawText:'29',version:1,userId:alice.user.id},coach)).status,409,'Coach cannot write to another member’s existing record');
 assert.equal((await request(path,'PUT',{rawText:'25,8 / 26.2',distances:[200],version:1},alice)).status,400);
 assert.equal((await request(path,'PUT',{rawText:'25,8 / 26.2',distances:[0,null],version:1},alice)).status,400);
 assert.equal((await request(path,'PUT',{rawText:'25,8 / 26.2',distances:[200,null],sessionVariant:2,version:1},alice)).status,200);
 assert.equal((await request(path,'PUT',{rawText:'99',sessionVariant:1,version:1},alice)).status,409);
 assert.equal((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).sessionVariant,2,'A conflicting edit must not change the chosen variant');
 assert.equal((await state(coach)).sessionResults.find(r=>r.sessionId===s1.id&&r.userId===alice.user.id).sessionVariant,2);
 assert.equal((await state(bob)).sessionResults[0].sessionVariant,1,'Another athlete keeps their own variant');
 assert.equal((await request(path,'PUT',{rawText:'27 / 28',sessionVariant:2,version:1},bob)).status,200);
 assert.equal((await state(bob)).sessionResults[0].sessionVariant,2);
 assert.equal((await request(path,'PUT',{rawText:'27 / 28',sessionVariant:1,version:2},bob)).status,200);
 assert.equal((await state(bob)).sessionResults[0].sessionVariant,1,'A member can correct the chosen variant after saving');
 assert.deepEqual((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).times,[25.8,26.2]);
 assert.deepEqual((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).distances,[200,null]);
 assert.deepEqual((await state(coach)).sessionResults.find(r=>r.sessionId===s1.id&&r.userId===alice.user.id).distances,[200,null]);
 const {initializeCommunity}=await import('./community.mjs');await initializeCommunity(DB);
 assert.equal((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).sessionVariant,2,'Additive migration preserves the selected variant');
 assert.deepEqual((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).distances,[200,null],'Reinitialization preserves distances');
 assert.equal((await request('/account/coach','PUT',{coach:true,version:1},owner)).status,200);
 let adminState=await state(owner);assert.equal(adminState.user.role,'admin');assert.equal(adminState.user.coachEnabled,true);assert.equal(adminState.sessionResults.length,3);assert.ok(adminState.accessCodes);
 assert.equal(adminState.comments.some(c=>c.body==='Privé coach'),true,'Admin with coach powers can read coach-private feedback');
 assert.equal((await request('/sessions','POST',{title:'Séance par admin coach',date:'2030-01-01',type:'speed',targets:[]},owner)).status,201);
 assert.equal((await request(path,'PUT',{rawText:'32',version:0},owner)).status,200);
 assert.equal((await request('/profile','PUT',{times:{200:24},version:adminState.profileVersion},owner)).status,200);
 assert.deepEqual((await state(owner)).profile.times,{200:24});assert.deepEqual((await state(alice)).profile.times,undefined);
 const moved={...s1,date:'2026-10-20'};assert.equal((await request('/sessions/'+s1.id,'PUT',moved,coach)).status,200);
 assert.equal((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).session.date,'2026-10-20');
 assert.equal((await request('/sessions/'+s1.id,'DELETE',{version:2},coach)).status,200);
 assert.equal((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).session.archived,true);
 assert.equal((await request(path,'PUT',{rawText:'26',version:2},alice)).status,409,'An outdated client cannot silently discard distances when changing repetition count');
 assert.equal((await request(path,'PUT',{rawText:'26',distances:[250],version:2},alice)).status,200,'Existing archived results remain editable');
 assert.deepEqual((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).distances,[250]);
 assert.equal((await state(alice)).sessionResults.find(r=>r.sessionId===s1.id).sessionVariant,2,'A legacy client omitting the variant cannot reset it');
 assert.equal((await request('/account/coach','PUT',{coach:false,version:2},owner)).status,200);
 adminState=await state(owner);assert.equal(adminState.user.role,'admin');assert.equal(adminState.user.coachEnabled,false);assert.equal(adminState.sessionResults.length,1);
 assert.equal(adminState.comments.some(c=>c.body==='Privé coach'),false);
 assert.equal((await request('/sessions','POST',{title:'Non autorisée',date:'2030-01-01',type:'speed',targets:[]},owner)).status,403);
 assert.equal((await request('/account/coach','PUT',{coach:true,version:3},alice)).status,409);
 assert.equal((await request('/account/coach','PUT',{coach:true,version:1},bob)).status,400);
 assert.equal((await request(path,'DELETE',{version:3,userId:bob.user.id},alice)).status,200);
 assert.equal(native.prepare('SELECT COUNT(*) AS n FROM session_result_distances WHERE session_id=? AND user_id=?').get(s1.id,alice.user.id).n,0);
 assert.equal(native.prepare('SELECT COUNT(*) AS n FROM session_result_variants WHERE session_id=? AND user_id=?').get(s1.id,alice.user.id).n,0);
 assert.equal((await state(bob)).sessionResults.length,1);
 assert.equal((await request('/account','DELETE',{identifier:'Bob',confirm:true},bob)).status,200);
 assert.equal(native.prepare('SELECT COUNT(*) AS n FROM session_results WHERE user_id=?').get(bob.user.id).n,0);
 assert.equal(native.prepare('SELECT COUNT(*) AS n FROM session_result_distances WHERE user_id=?').get(bob.user.id).n,0);
 assert.equal(native.prepare('SELECT COUNT(*) AS n FROM session_result_variants WHERE user_id=?').get(bob.user.id).n,0);
 assert.equal((await state(coach)).sessionResults.some(r=>r.userId===bob.user.id),false);
 await initializeCommunity(DB);
 assert.equal((await state(alice)).sessionResults.length,1,'Migration preserves personal results');
 assert.deepEqual((await state(owner)).profile.times,{200:24});
});
