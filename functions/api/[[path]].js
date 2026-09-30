import seed from '../../seed.json';
import { library, info } from '../../content.mjs';

const schema = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}', profile_version INTEGER NOT NULL DEFAULT 1, last_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', account_version INTEGER NOT NULL DEFAULT 1, previous_role TEXT NOT NULL DEFAULT 'athlete');
CREATE TABLE IF NOT EXISTS auth (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(collection,id));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS role_events (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, member TEXT NOT NULL, previous_role TEXT NOT NULL, next_role TEXT NOT NULL, created INTEGER NOT NULL);
INSERT OR IGNORE INTO meta VALUES ('revision',1);
INSERT OR IGNORE INTO meta VALUES ('setup_complete',0);
INSERT OR IGNORE INTO meta VALUES ('last_session_cleanup',0);`;

const json = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const error = (message,status=400) => {throw Object.assign(new Error(message),{status});};
const str = (value,label,max=20000,required=false) => {
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))error(`${label} invalide.`);
 return value.trim();
};
const publicUser = user => ({id:user.id,email:user.email,name:user.name,lastName:user.last_name||'',phone:user.phone||'',role:user.role,accountVersion:user.account_version||1});
const stmt = (db,sql,...values) => db.prepare(sql).bind(...values);
let initialization;
async function digest(value) {
 const data=new TextEncoder().encode(value), bytes=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function initialize(db) {
 if(!initialization)initialization=(async()=>{
  await db.exec(schema);
  const ready=await db.prepare("SELECT value FROM meta WHERE key='seeded'").first();
  if(ready)return;
  await stmt(db,'INSERT OR IGNORE INTO users(id,email,name,role,last_name) VALUES(?,?,?,?,?)',crypto.randomUUID(),'maylis','Maylis','admin','Chancerelle').run();
  const entries=Object.entries({sessions:seed.sessions,library,info}).flatMap(([collection,items])=>items.map(item=>stmt(db,'INSERT OR IGNORE INTO records(collection,id,data) VALUES(?,?,?)',collection,item.id,JSON.stringify(item))));
  for(let i=0;i<entries.length;i+=40)await db.batch(entries.slice(i,i+40));
  await db.prepare("INSERT OR IGNORE INTO meta VALUES ('seeded',1)").run();
 })();
 try{await initialization;}catch(e){initialization=null;throw e;}
}
async function cleanupOldSessions(db) {
 const now=Date.now();
 const last=await db.prepare("SELECT value FROM meta WHERE key='last_session_cleanup'").first();
 if(last && now-last.value<86400000)return;
 const cutoff=new Date(now-90*86400000).toISOString().slice(0,10);
 const removed=await stmt(db,"DELETE FROM records WHERE collection='sessions' AND json_extract(data,'$.date') < ?",cutoff).run();
 await stmt(db,"UPDATE meta SET value=? WHERE key='last_session_cleanup'",now).run();
 if(removed.meta.changes)await db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();
}
const versionCheck=(actual,wanted)=>{if(actual!==wanted)error('Cet élément a été modifié ailleurs. Rechargez la page pour voir la dernière version.',409);};
const TYPES=['speed','strength','vo2','endurance','hills','competition','group','rest'];
function validateDate(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))error('Date invalide.');
 const date=new Date(`${value}T12:00:00Z`);
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)error('Date invalide.');
 return value;
}
function recordData(collection,body) {
 const item={title:str(body.title,'Titre',180,true)};
 if(collection==='sessions') {
  if(!TYPES.includes(body.type))error('Type de séance invalide.');
  if(!['non-precise','matin','apres-midi','soir'].includes(body.slot||'non-precise'))error('Créneau invalide.');
  Object.assign(item,{date:validateDate(body.date),type:body.type,slot:body.slot||'non-precise'});
  if(!['auto','none','light','medium','high'].includes(body.load||'auto'))error('Charge de séance invalide.');
  item.load=body.load||'auto';
  for(const key of ['warmup','workout','v2','coachNote','cycle'])item[key]=str(body[key]??'',key);
  if(!Array.isArray(body.targets)||body.targets.length>20)error('Allures invalides.');
  item.targets=body.targets.map(t=>{
   if(!Number.isInteger(t.distance)||t.distance<=0||t.distance>10000)error('Distance cible invalide.');
   const label=str(t.label||'','Groupe cible',60);
   if(t.kind==='range'){
    if(typeof t.minTime!=='number'||typeof t.maxTime!=='number'||!Number.isFinite(t.minTime)||!Number.isFinite(t.maxTime)||t.minTime<=0||t.maxTime<t.minTime||t.maxTime>86400)error('Plage de temps invalide : la borne finale doit être supérieure ou égale à la première.');
    return {distance:t.distance,kind:'range',label,minTime:t.minTime,maxTime:t.maxTime};
   }
   if(t.kind&&t.kind!=='percent')error('Type de cible invalide.');
   if(typeof t.percent!=='number'||!Number.isFinite(t.percent)||t.percent<=0||t.percent>150)error('Pourcentage invalide.');
   return {distance:t.distance,kind:'percent',label,percent:t.percent};
  });
 } else {
  item.body=str(body.body,'Texte',20000,true);
  const categories=collection==='library'?['acronym','circuit']:['organisation','relationnel'];
  if(!categories.includes(body.category))error('Catégorie invalide.');
  item.category=body.category;
  if(collection==='info')item.icon=str(body.icon||'','Icône',16);
 }
 return item;
}
async function getRecord(db,collection,id) {
 const row=await stmt(db,'SELECT * FROM records WHERE collection=? AND id=? AND archived=0',collection,id).first();
 if(!row)error('Élément introuvable.',404);
 return {...JSON.parse(row.data),version:row.version};
}
async function userFromRequest(db,request) {
 const bearer=request.headers.get('Authorization');
 if(!bearer?.startsWith('Bearer '))return null;
 return stmt(db,'SELECT auth.token,users.* FROM auth JOIN users ON users.id=auth.user_id WHERE auth.token=? AND auth.expires>?',await digest(bearer.slice(7)),Date.now()).first();
}
async function session(db,user) {
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
 await stmt(db,'INSERT INTO auth(token,user_id,expires) VALUES(?,?,?)',await digest(token),user.id,Date.now()+12*3600000).run();
 return {user:publicUser(user),accessToken:token,csrf:null};
}
async function bodyJSON(request) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))error('JSON requis.',415);
 if(Number(request.headers.get('content-length')||0)>128*1024)error('Contenu trop volumineux.',413);
 try{const value=await request.json();if(!value||Array.isArray(value)||typeof value!=='object')error('JSON invalide.');return value;}catch(e){if(e.status)throw e;error('JSON invalide.');}
}
async function handle(request,db) {
 const path=new URL(request.url).pathname,method=request.method;
 const ctx=await userFromRequest(db,request);
 const setupComplete=!!(await db.prepare("SELECT value FROM meta WHERE key='setup_complete'").first())?.value;
 if(method==='GET'&&path==='/api/auth')return json({setup:!setupComplete,pending:setupComplete?null:{name:'Maylis',lastName:'Chancerelle',email:'maylis'},setupCodeRequired:false,user:ctx?publicUser(ctx):null,csrf:null});
 const body=method==='GET'?{}:await bodyJSON(request);
 if(method==='POST'&&['/api/login','/api/setup','/api/register'].includes(path)) {
  const email=str(body.email,'Identifiant',180,true).toLowerCase();
  if(path==='/api/login'){
   const user=await stmt(db,'SELECT * FROM users WHERE email=?',email).first();
   if(!user||(!setupComplete&&user.role==='admin'))error('Identifiant inconnu. Inscrivez-vous pour créer votre profil.',401);
   return json(await session(db,user));
  }
  const name=str(body.name,'Prénom',80,true),lastName=str(body.lastName||'','Nom',80),phone=str(body.phone||'','Téléphone',40);
  if(path==='/api/setup'){
   if(setupComplete)error('Initialisation indisponible.',403);
   const reserved=await stmt(db,"SELECT * FROM users WHERE role='admin' LIMIT 1").first();
   if(!reserved)error('Profil administrateur absent.',409);
   const duplicate=await stmt(db,'SELECT id FROM users WHERE email=? AND id!=?',email,reserved.id).first();
   if(duplicate)error('Cet identifiant est déjà utilisé.',409);
   await db.batch([stmt(db,'UPDATE users SET email=?,name=?,last_name=?,phone=? WHERE id=?',email,name,lastName,phone,reserved.id),db.prepare("UPDATE meta SET value=1 WHERE key='setup_complete'"),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);
   return json(await session(db,{...reserved,email,name,last_name:lastName,phone}),201);
  }
  if(await stmt(db,'SELECT id FROM users WHERE email=?',email).first())error('Cet identifiant est déjà utilisé.',409);
  const role=body.coach?'coach':'athlete';
  const user={id:crypto.randomUUID(),email,name,last_name:lastName,phone,role,account_version:1};
  const actions=[stmt(db,'INSERT INTO users(id,email,name,role,last_name,phone) VALUES(?,?,?,?,?,?)',user.id,email,name,role,lastName,phone),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")];
  await db.batch(actions);
  return json(await session(db,user),201);
 }
 if(!ctx)error('Connectez-vous pour accéder à l’équipe.',401);
 if(method==='POST'&&path==='/api/logout'){
  await stmt(db,'DELETE FROM auth WHERE token=?',ctx.token).run();return json({ok:true});
 }
 if(method==='GET'&&path==='/api/state'){
  const [meta,members,rows]=await Promise.all([
   db.prepare("SELECT value FROM meta WHERE key='revision'").first(),
   db.prepare('SELECT id,name,last_name AS lastName,phone,role FROM users ORDER BY name COLLATE NOCASE,last_name COLLATE NOCASE').all(),
   db.prepare('SELECT * FROM records WHERE archived=0 ORDER BY rowid').all()
  ]);
  const result={revision:meta.value,user:publicUser(ctx),members:members.results,profile:JSON.parse(ctx.profile),profileVersion:ctx.profile_version,sessions:[],library:[],info:[]};
  for(const row of rows.results){const item={...JSON.parse(row.data),version:row.version};if(ctx.role!=='coach'){delete item.coachNote;delete item.sourceText;}result[row.collection].push(item);}
  return json(result);
 }
 if(method==='PUT'&&path==='/api/profile'){
  if(!body.times||typeof body.times!=='object'||Array.isArray(body.times))error('Chronos invalides.');
  const times={},distances=[50,60,80,100,125,150,200,250,300,400,500,600,800,1000,1500];
  for(const [d,t] of Object.entries(body.times)){if(!distances.includes(Number(d))||typeof t!=='number'||!Number.isFinite(t)||t<=0||t>86400)error('Chrono invalide.');times[d]=t;}
  const result=await stmt(db,'UPDATE users SET profile=?,profile_version=profile_version+1 WHERE id=? AND profile_version=?',JSON.stringify({times}),ctx.id,body.version).run();
  if(!result.meta.changes)error('Ce profil a été modifié ailleurs. Rechargez la page.',409);
  return json({ok:true});
 }
 if(method==='PUT'&&path==='/api/account'){
  if('role' in body)error('Le rôle ne se modifie pas dans les réglages personnels.',403);
  const name=str(body.name,'Prénom',80,true),lastName=str(body.lastName||'','Nom',80),phone=str(body.phone||'','Téléphone',40);
  const result=await stmt(db,'UPDATE users SET name=?,last_name=?,phone=?,account_version=account_version+1 WHERE id=? AND account_version=?',name,lastName,phone,ctx.id,body.version).run();
  if(!result.meta.changes)error('Ce profil a été modifié ailleurs. Rechargez la page.',409);
  await db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();return json({ok:true});
 }
 if(method==='DELETE'&&path==='/api/account'){
  if(body.confirm!==true||str(body.identifier,'Identifiant',180,true).toLowerCase()!==ctx.email)error('Confirmez la suppression avec votre identifiant.',403);
  if(ctx.role==='admin'&&(await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first()).count<=1)error('Nommez un autre administrateur avant de supprimer votre profil.',409);
  await db.batch([stmt(db,'DELETE FROM auth WHERE user_id=?',ctx.id),stmt(db,'DELETE FROM users WHERE id=?',ctx.id),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);return json({ok:true});
 }
 const roleMatch=path.match(/^\/api\/members\/([^/]+)\/admin$/);
 if(method==='PUT'&&roleMatch){
  if(ctx.role!=='admin')error('Seul un administrateur peut modifier les droits admin.',403);
  const member=await stmt(db,'SELECT * FROM users WHERE id=?',decodeURIComponent(roleMatch[1])).first();
  if(!member)error('Membre introuvable.',404);
  if(member.role!==body.expectedRole)error('Le rôle a changé. Actualisez la page.',409);
  let role,previous=member.previous_role;
  if(body.action==='grant-admin'){if(member.role==='admin')error('Ce membre est déjà administrateur.');previous=member.role;role='admin';}
  else if(body.action==='revoke-admin'){
   if(member.role!=='admin')error('Ce membre n’est pas administrateur.');
   if((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first()).count<=1)error('Nommez un autre administrateur avant de retirer les droits du dernier admin.',409);
   role=previous==='coach'?'coach':'athlete';
  }else error('Action invalide.');
  await db.batch([stmt(db,'UPDATE users SET role=?,previous_role=?,account_version=account_version+1 WHERE id=?',role,previous,member.id),stmt(db,'INSERT INTO role_events(actor,member,previous_role,next_role,created) VALUES(?,?,?,?,?)',ctx.id,member.id,member.role,role,Date.now()),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);return json({ok:true,role});
 }
 if(ctx.role!=='coach')error('Cette action est réservée au coach.',403);
 const match=path.match(/^\/api\/(sessions|library|info)(?:\/([^/]+))?$/);
 if(!match)error('Route introuvable.',404);
 const [,collection,encoded]=match,id=encoded?decodeURIComponent(encoded):null;
 if(method==='POST'&&!id){
  const item={...recordData(collection,body),id:crypto.randomUUID(),version:1};
  await db.batch([stmt(db,'INSERT INTO records(collection,id,data) VALUES(?,?,?)',collection,item.id,JSON.stringify(item)),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);return json(item,201);
 }
 if(method==='PUT'&&id){
  const old=await getRecord(db,collection,id);versionCheck(old.version,body.version);
  const item={...old,...recordData(collection,body),version:old.version+1};
  const actions=[];
  if(collection==='sessions'&&body.swapId){
   if(body.swapId===id)error('Choisissez une autre séance.');
   const other=await getRecord(db,'sessions',body.swapId);versionCheck(other.version,body.swapVersion);
   if(item.date!==other.date)error('La date cible ne correspond pas à la séance à échanger.');
   const swapped={...other,date:old.date,slot:old.slot||'non-precise',version:other.version+1};
   actions.push(stmt(db,'UPDATE records SET data=?,version=? WHERE collection=? AND id=? AND version=?',JSON.stringify(swapped),swapped.version,'sessions',other.id,other.version));
  }
  actions.push(stmt(db,'UPDATE records SET data=?,version=? WHERE collection=? AND id=? AND version=?',JSON.stringify(item),item.version,collection,id,old.version));
  actions.push(db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'"));
  const results=await db.batch(actions);if(results.slice(0,-1).some(r=>!r.meta.changes))error('La séance a changé ailleurs. Rechargez la page.',409);
  return json(item);
 }
 if(method==='DELETE'&&id){
  const old=await getRecord(db,collection,id);versionCheck(old.version,body.version);
  await db.batch([stmt(db,'UPDATE records SET archived=1,version=version+1 WHERE collection=? AND id=?',collection,id),db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);return json({ok:true});
 }
 error('Route introuvable.',404);
}

export async function onRequest({request,env}) {
 try{
  if(!env.DB)error('Base de données Cloudflare non configurée.',503);
  await initialize(env.DB);
  await cleanupOldSessions(env.DB);
  return await handle(request,env.DB);
 }catch(e){if(!e.status)console.error(e);return json({error:e.status?e.message:'Erreur du serveur.'},e.status||500);}
}
