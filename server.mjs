import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { library, info } from './content.mjs';
import { defaultSeason, normalizeSeason } from './season.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.ATHLE_DATA_DIR || join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const ORIGIN = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const production = process.env.NODE_ENV === 'production';
if (production && !ORIGIN.startsWith('https://')) throw new Error('APP_ORIGIN HTTPS obligatoire en production.');
process.umask(0o077);
mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(join(DATA, 'athle.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','coach','athlete')), profile TEXT NOT NULL DEFAULT '{}', profile_version INTEGER NOT NULL DEFAULT 1,
 last_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', account_version INTEGER NOT NULL DEFAULT 1, previous_role TEXT NOT NULL DEFAULT 'athlete');
 CREATE TABLE IF NOT EXISTS auth (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(collection,id));
 CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS role_events (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, member TEXT NOT NULL, previous_role TEXT NOT NULL, next_role TEXT NOT NULL, created INTEGER NOT NULL);
 INSERT OR IGNORE INTO meta VALUES ('revision',1);
 INSERT OR IGNORE INTO meta VALUES ('setup_complete',0);`);
if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='previous_role')) db.exec("ALTER TABLE users ADD COLUMN previous_role TEXT NOT NULL DEFAULT 'athlete'");
db.prepare("UPDATE meta SET value=1 WHERE key='setup_complete' AND EXISTS (SELECT id FROM users WHERE role='admin' AND password!='')").run();
if (!db.prepare("SELECT value FROM meta WHERE key='seeded'").get()) {
 const seed = JSON.parse(readFileSync(join(ROOT, 'seed.json'), 'utf8'));
 db.exec('BEGIN');
 try {
  const insert = db.prepare('INSERT INTO records(collection,id,data) VALUES (?,?,?)');
  for (const [collection, items] of Object.entries({ sessions: seed.sessions, library, info })) {
   for (const item of items) insert.run(collection, item.id, JSON.stringify(item));
  }
  db.exec("INSERT INTO meta VALUES ('seeded',1); COMMIT;");
 } catch (e) { db.exec('ROLLBACK'); throw e; }
}
if(db.prepare('INSERT OR IGNORE INTO records(collection,id,data) VALUES(?,?,?)').run('season','2026-2027',JSON.stringify(defaultSeason)).changes)db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();
if (!db.prepare('SELECT id FROM users LIMIT 1').get()) {
 db.prepare("INSERT INTO users(id,email,name,last_name,password,role) VALUES(?,?,?,?,?,?)").run(randomUUID(),'maylis','Maylis','Chancerelle','','admin');
}
const hasUsers = () => !!db.prepare("SELECT value FROM meta WHERE key='setup_complete'").get()?.value;
const hash = value => createHash('sha256').update(value).digest('hex');
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
function text(value, label, max=20000, required=false) {
 if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label} invalide.`);
 return value.trim();
}
function validDate(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Date invalide.');
 const parsed = new Date(`${value}T12:00:00Z`);
 if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== value) fail('Date invalide.');
 return value;
}
const TYPES = ['speed','strength','vo2','endurance','hills','competition','group','rest'];
function recordData(collection, body) {
 const result = {title:text(body.title,'Titre',180,true)};
 if (collection === 'sessions') {
  if (!TYPES.includes(body.type)) fail('Type de séance invalide.');
  if(!['non-precise','matin','apres-midi','soir'].includes(body.slot || 'non-precise'))fail('Créneau invalide.');
  Object.assign(result, {date:validDate(body.date), type:body.type, slot:body.slot || 'non-precise'});
  if(!['auto','none','light','medium','high'].includes(body.load || 'auto'))fail('Charge de séance invalide.');
  result.load=body.load || 'auto';
  for (const field of ['warmup','workout','v2','coachNote','cycle']) result[field]=text(body[field] ?? '',field);
  if (!Array.isArray(body.targets) || body.targets.length > 20) fail('Allures invalides.');
  result.targets=body.targets.map(t=>{
   if (!Number.isInteger(t.distance) || t.distance<=0 || t.distance>10000) fail('Distance cible invalide.');
   const label=text(t.label || '','Groupe cible',60);
   if(t.kind==='range'){
    if(typeof t.minTime!=='number'||typeof t.maxTime!=='number'||!Number.isFinite(t.minTime)||!Number.isFinite(t.maxTime)||t.minTime<=0||t.maxTime<t.minTime||t.maxTime>86400)fail('Plage de temps invalide : la borne finale doit être supérieure ou égale à la première.');
    return {distance:t.distance,kind:'range',label,minTime:t.minTime,maxTime:t.maxTime};
   }
   if(t.kind&&t.kind!=='percent')fail('Type de cible invalide.');
   if(typeof t.percent!=='number'||!Number.isFinite(t.percent)||t.percent<=0||t.percent>150)fail('Pourcentage invalide.');
   return {distance:t.distance,kind:'percent',label,percent:t.percent};
  });
 } else {
  result.body=text(body.body,'Texte',20000,true);
  const categories = collection === 'library' ? ['acronym','circuit'] : ['organisation','relationnel'];
  if (!categories.includes(body.category)) fail('Catégorie invalide.');
  result.category=body.category;
  if (collection==='info') result.icon=text(body.icon||'','Icône',16);
 }
 return result;
}
function readRecord(collection,id) {
 const row=db.prepare('SELECT * FROM records WHERE collection=? AND id=? AND archived=0').get(collection,id);
 if (!row) fail('Élément introuvable.',404);
 return {...JSON.parse(row.data), version:row.version};
}
function versionCheck(actual, requested) {
 if (actual !== requested) fail('Cet élément a été modifié ailleurs. Fermez puis rouvrez le formulaire pour consulter la dernière version.',409);
}
function saveRecord(collection, item) {
 db.prepare('UPDATE records SET data=?,version=? WHERE collection=? AND id=?').run(JSON.stringify(item),item.version,collection,item.id);
}
const bump = () => db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();
function atomic(action) {
 db.exec('BEGIN IMMEDIATE');
 try {const result=action();db.exec('COMMIT');return result;} catch(e){db.exec('ROLLBACK');throw e;}
}
const limits = new Map();
function throttle(key) {
 const now=Date.now();
 for(const [k,v] of limits) if(v.until<now) limits.delete(k);
 const v=limits.get(key)||{until:now+15*60*1000,count:0};
 limits.set(key,v);v.count++;
 if(v.count>25) fail('Trop de tentatives. Réessayez dans 15 minutes.',429);
}
function context(req) {
 const bearer=req.headers.authorization;
 if (!bearer?.startsWith('Bearer ')) return null;
 return db.prepare('SELECT auth.token,auth.csrf,users.id,users.name,users.email,users.role,users.profile,users.profile_version,users.last_name,users.phone,users.account_version FROM auth JOIN users ON users.id=auth.user_id WHERE token=? AND expires>?').get(hash(bearer.slice(7)), Date.now());
}
function publicUser(u) {return {id:u.id,name:u.name,lastName:u.last_name||'',phone:u.phone||'',email:u.email,role:u.role,accountVersion:u.account_version||1};}
function loginCookie(res, user) {
 const token=randomBytes(32).toString('hex'), csrf=randomBytes(24).toString('hex');
 db.prepare('DELETE FROM auth WHERE expires<?').run(Date.now());
 db.prepare('INSERT INTO auth VALUES(?,?,?,?)').run(hash(token),user.id,csrf,Date.now()+12*3600000);
 return {user:publicUser(user),csrf,accessToken:token};
}
async function bodyJSON(req) {
 let size=0,chunks=[];
 for await (const chunk of req) {size+=chunk.length;if(size>128*1024) fail('Contenu trop volumineux.',413);chunks.push(chunk);}
 try {const value=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!value||Array.isArray(value)||typeof value!=='object')fail('JSON invalide.');return value;}catch(e){if(e.status)throw e;fail('JSON invalide.');}
}
const allowedStatic = new Map([
 ['/', ['index.html','text/html']], ['/index.html',['index.html','text/html']],
 ['/app.js',['app.js','text/javascript']], ['/core.mjs',['core.mjs','text/javascript']], ['/season.mjs',['season.mjs','text/javascript']], ['/style.css',['style.css','text/css']], ['/layout.css',['layout.css','text/css']], ['/calendar.css',['calendar.css','text/css']], ['/service-worker.js',['service-worker.js','text/javascript']], ['/manifest.webmanifest',['manifest.webmanifest','application/manifest+json']], ['/icon.svg',['icon.svg','image/svg+xml']]
]);
async function handle(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 try {
  const acceptedHosts=new Set([new URL(ORIGIN).host, ...(!production?[`localhost:${PORT}`,`127.0.0.1:${PORT}`]:[])]);
  if(!acceptedHosts.has(req.headers.host)) fail('Hôte non autorisé.',403);
  const path=new URL(req.url,ORIGIN).pathname;
  if (req.method==='GET' && allowedStatic.has(path)) {
   const [file,mime]=allowedStatic.get(path);res.writeHead(200,{'Content-Type':mime+'; charset=utf-8'});res.end(readFileSync(join(ROOT,file)));return;
  }
  if(!path.startsWith('/api/')) fail('Page introuvable.',404);
  if (!['GET','POST','PUT','DELETE'].includes(req.method)) fail('Méthode non autorisée.',405);
  const ctx=context(req);
  if(req.method==='GET' && path==='/api/auth') {
   const setupAllowed=!hasUsers();
   const pending=setupAllowed?db.prepare("SELECT name,last_name AS lastName,email FROM users WHERE role='admin' LIMIT 1").get():null;
   reply({setup:!!pending,pending,setupCodeRequired:false,user:ctx?publicUser(ctx):null,csrf:ctx?.csrf});return;
  }
  let body={};
  if(req.method!=='GET') {
   if(!req.headers.origin || !acceptedHosts.has(new URL(req.headers.origin).host) || (production && req.headers.origin!==ORIGIN)) fail('Origine non autorisée.',403);
   if(!(req.headers['content-type']||'').startsWith('application/json')) fail('JSON requis.',415);
   if(ctx && req.headers['x-csrf-token']!==ctx.csrf) fail('Session de formulaire invalide. Rechargez la page.',403);
   body=await bodyJSON(req);
  }
  if(req.method==='POST' && ['/api/login','/api/setup','/api/register'].includes(path)) {
   throttle(req.socket.remoteAddress);
   const email=text(body.email,'Identifiant',180,true).toLowerCase();
   if (path==='/api/login') {
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if(!user || (user.role==='admin' && !hasUsers())) fail('Identifiant inconnu. Inscrivez-vous pour créer votre profil.',401);
    reply(loginCookie(res,user));return;
   }
   const name=text(body.name,'Prénom',80,true);
   const lastName=text(body.lastName||'','Nom',80),phone=text(body.phone||'','Téléphone',40);
   const user=atomic(()=>{
    let role='athlete';
    if(path==='/api/setup') {
     if(hasUsers()) fail('Initialisation indisponible.',403);
     role='admin';
    } else if(body.coach) role='coach';
    if(path==='/api/setup') {
     const reserved=db.prepare("SELECT * FROM users WHERE role='admin' AND password='' LIMIT 1").get();
     if(!reserved)fail('Aucun compte administrateur en attente.',403);
     if(db.prepare('SELECT id FROM users WHERE email=? AND id!=?').get(email,reserved.id))fail('Cet identifiant est déjà utilisé.',409);
     db.prepare('UPDATE users SET email=?,name=?,last_name=?,phone=? WHERE id=?').run(email,name,lastName,phone,reserved.id);
     db.prepare("UPDATE meta SET value=1 WHERE key='setup_complete'").run();bump();
     return {...reserved,email,name,last_name:lastName,phone};
    }
    if(db.prepare('SELECT id FROM users WHERE email=?').get(email))fail('Cet identifiant est déjà utilisé.',409);
    const user={id:randomUUID(),email,name,role,last_name:lastName,phone};
    db.prepare('INSERT INTO users(id,email,name,password,role,last_name,phone) VALUES(?,?,?,?,?,?,?)').run(user.id,email,name,'',user.role,lastName,phone);
    bump();
    return user;
   });
   reply(loginCookie(res,user),201);return;
  }
  if(!ctx)fail('Connectez-vous pour accéder à l’équipe.',401);
  if(req.method==='POST' && path==='/api/logout') {
   db.prepare('DELETE FROM auth WHERE token=?').run(ctx.token);reply({ok:true});return;
  }
  if(req.method==='GET' && path==='/api/state') {
   const result={revision:db.prepare("SELECT value FROM meta WHERE key='revision'").get().value,user:publicUser(ctx),members:db.prepare('SELECT id,name,last_name AS lastName,phone,role FROM users ORDER BY name COLLATE NOCASE,last_name COLLATE NOCASE').all(),profile:JSON.parse(ctx.profile),profileVersion:ctx.profile_version,sessions:[],library:[],info:[],season:null};
   for(const row of db.prepare('SELECT * FROM records WHERE archived=0 ORDER BY rowid').all()) {
    const item={...JSON.parse(row.data),version:row.version};
    if(row.collection==='season'){result.season=item;continue;}
    if(ctx.role!=='coach'){delete item.coachNote;delete item.sourceText;}
    result[row.collection].push(item);
   }
   reply(result);return;
  }
  if(req.method==='PUT' && path==='/api/profile') {
   if(!body.times || typeof body.times!=='object'||Array.isArray(body.times))fail('Chronos invalides.');
   const times={};
   const distances=[50,60,80,100,125,150,200,250,300,400,500,600,800,1000,1500];
   for(const [d,t] of Object.entries(body.times)) {
    if(!distances.includes(Number(d))||typeof t!=='number'||!Number.isFinite(t)||t<=0||t>86400)fail('Chrono invalide.');
    times[d]=t;
   }
   const current=db.prepare('SELECT profile_version FROM users WHERE id=?').get(ctx.id);
   versionCheck(current.profile_version,body.version);
   db.prepare('UPDATE users SET profile=?,profile_version=profile_version+1 WHERE id=?').run(JSON.stringify({times}),ctx.id);
   reply({ok:true});return;
  }
  if(req.method==='PUT' && path==='/api/account') {
   if('role' in body)fail('Le rôle ne se modifie pas dans les réglages personnels.',403);
   const email=text(body.email,'Identifiant',180,true).toLowerCase();
   const name=text(body.name,'Prénom',80,true),lastName=text(body.lastName||'','Nom',80),phone=text(body.phone||'','Téléphone',40);
   atomic(()=>{
    const current=db.prepare('SELECT account_version FROM users WHERE id=?').get(ctx.id);versionCheck(current.account_version,body.version);
    if(db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email,ctx.id))fail('Cet identifiant est déjà utilisé.',409);
    db.prepare('UPDATE users SET email=?,name=?,last_name=?,phone=?,account_version=account_version+1 WHERE id=?').run(email,name,lastName,phone,ctx.id);bump();
   });reply({ok:true});return;
  }
  if(req.method==='DELETE' && path==='/api/account') {
   throttle(req.socket.remoteAddress);
   if(body.confirm!==true)fail('Confirmez la suppression du profil.');
   if(text(body.identifier,'Identifiant',180,true)!==ctx.email)fail('Identifiant incorrect.',403);
   atomic(()=>{
    const member=db.prepare('SELECT role FROM users WHERE id=?').get(ctx.id);
    if(member.role==='admin' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count<=1)fail('Nommez un autre administrateur avant de supprimer votre profil.',409);
    db.prepare('DELETE FROM auth WHERE user_id=?').run(ctx.id);
    db.prepare('DELETE FROM users WHERE id=?').run(ctx.id);bump();
   });reply({ok:true});return;
  }
  const roleMatch=path.match(/^\/api\/members\/([^/]+)\/admin$/);
  if(req.method==='PUT' && roleMatch) {
   if(ctx.role!=='admin')fail('Seul un administrateur peut modifier les droits admin.',403);
   const result=atomic(()=>{
    const member=db.prepare('SELECT * FROM users WHERE id=?').get(decodeURIComponent(roleMatch[1]));
    if(!member)fail('Membre introuvable.',404);
    if(member.role!==body.expectedRole)fail('Le rôle a changé. Actualisez la page avant de réessayer.',409);
    let nextRole,previousRole=member.previous_role;
    if(body.action==='grant-admin'){
     if(member.role==='admin')fail('Ce membre est déjà administrateur.');
     previousRole=member.role;nextRole='admin';
    }else if(body.action==='revoke-admin'){
     if(member.role!=='admin')fail('Ce membre n’est pas administrateur.');
     const count=db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count;
     if(count<=1)fail('Nommez un autre administrateur avant de retirer les droits du dernier admin.',409);
     nextRole=previousRole==='coach'?'coach':'athlete';
    }else fail('Action invalide.');
    db.prepare('UPDATE users SET role=?,previous_role=?,account_version=account_version+1 WHERE id=?').run(nextRole,previousRole,member.id);
    db.prepare('INSERT INTO role_events(actor,member,previous_role,next_role,created) VALUES(?,?,?,?,?)').run(ctx.id,member.id,member.role,nextRole,Date.now());bump();
    return {ok:true,role:nextRole};
   });reply(result);return;
  }
  if(ctx.role!=='coach')fail('Cette action est réservée au coach.',403);
  if(req.method==='PUT'&&path==='/api/season'){
   let data;try{data=normalizeSeason(body);}catch(e){fail(e.message);}
   const updated=atomic(()=>{const old=readRecord('season','2026-2027');versionCheck(old.version,body.version);db.prepare('UPDATE records SET data=?,version=? WHERE collection=? AND id=?').run(JSON.stringify(data),old.version+1,'season','2026-2027');bump();return {...data,version:old.version+1};});
   reply(updated);return;
  }
  const match=path.match(/^\/api\/(sessions|library|info)(?:\/([^/]+))?$/);
  if(!match)fail('Route introuvable.',404);
  const [,collection,encodedId]=match, id=encodedId?decodeURIComponent(encodedId):null;
  if(req.method==='POST' && !id) {
   const item={...recordData(collection,body),id:randomUUID(),version:1};
   atomic(()=>{db.prepare('INSERT INTO records(collection,id,data) VALUES(?,?,?)').run(collection,item.id,JSON.stringify(item));bump();});reply(item,201);return;
  }
  if(req.method==='PUT' && id) {
   const result=atomic(()=>{
    const old=readRecord(collection,id);versionCheck(old.version,body.version);
    const item={...old,...recordData(collection,body),version:old.version+1};
    if(collection==='sessions' && body.swapId) {
     if(body.swapId===id)fail('Choisissez une autre séance.');
     const other=readRecord('sessions',body.swapId);versionCheck(other.version,body.swapVersion);
     if(item.date!==other.date)fail('La date cible ne correspond pas à la séance à échanger.');
     saveRecord('sessions',{...other,date:old.date,slot:old.slot||'non-precise',version:other.version+1});
    }
    saveRecord(collection,item);bump();return item;
   });reply(result);return;
  }
  if(req.method==='DELETE' && id) {
   atomic(()=>{const old=readRecord(collection,id);versionCheck(old.version,body.version);db.prepare('UPDATE records SET archived=1,version=version+1 WHERE collection=? AND id=?').run(collection,id);bump();});reply({ok:true});return;
  }
  fail('Route introuvable.',404);
 } catch(e) {if(!e.status)console.error(e);if(!res.headersSent)reply({error:e.status?e.message:'Erreur du serveur.'},e.status||500);else res.end();}
}
const server=http.createServer(handle);
server.requestTimeout=15000;
server.listen(PORT,HOST,()=>console.log(`Équipe 400/4H : ${ORIGIN}\n${hasUsers()?'Connectez-vous avec votre identifiant.':'Profil admin Maylis Chancerelle prêt : choisissez un identifiant lors de la première ouverture.'}`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
