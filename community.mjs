import { competitionData, mondayOf } from './community-core.mjs';
import { seasonWeekDate } from './season.mjs';

const schema=`
CREATE TABLE IF NOT EXISTS account_created (user_id TEXT PRIMARY KEY, created INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS record_account_created AFTER INSERT ON users BEGIN INSERT INTO account_created(user_id,created) VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000); END;
CREATE TABLE IF NOT EXISTS account_credentials (user_id TEXT PRIMARY KEY, password_hash TEXT, initial_identifier TEXT, provisional INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS group_access_codes (id INTEGER PRIMARY KEY CHECK(id=1), group_code TEXT NOT NULL, coach_code TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS session_comments (session_id TEXT NOT NULL, user_id TEXT NOT NULL, rating INTEGER, body TEXT NOT NULL DEFAULT '', is_private INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL, PRIMARY KEY(session_id,user_id));
CREATE TABLE IF NOT EXISTS competition_signups (competition_id TEXT NOT NULL, user_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(competition_id,user_id));`;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const revision=db=>db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'");
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function passwordValue(value) {
 if(typeof value!=='string'||!value.length||value.length>1024)fail('Saisissez un mot de passe.');
 return value;
}
async function credentialForUser(db,user) {
 const current=await stmt(db,'SELECT * FROM account_credentials WHERE user_id=?',user.id).first();
 if(current)return current;
 await stmt(db,'INSERT OR IGNORE INTO account_credentials(user_id,initial_identifier) VALUES(?,?)',user.id,user.email).run();
 return stmt(db,'SELECT * FROM account_credentials WHERE user_id=?',user.id).first();
}
export async function passwordHash(value,salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {
 passwordValue(value);
 const key=await crypto.subtle.importKey('raw',encoder.encode(value),'PBKDF2',false,['deriveBits']);
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return `pbkdf2:${salt}:${hex(new Uint8Array(bytes))}`;
}
export async function passwordMatches(db,user,value) {
 passwordValue(value);
 const credential=await credentialForUser(db,user);
 if(!credential)return false;
 if(!credential.password_hash){
  if(value!==credential.initial_identifier)return false;
  await stmt(db,'UPDATE account_credentials SET password_hash=?,initial_identifier=NULL WHERE user_id=? AND password_hash IS NULL',await passwordHash(value),user.id).run();
  return true;
 }
 const salt=credential.password_hash.split(':')[1],candidate=await passwordHash(value,salt);
 let difference=candidate.length^credential.password_hash.length;
 for(let i=0;i<candidate.length;i++)difference|=candidate.charCodeAt(i)^credential.password_hash.charCodeAt(i);
 return difference===0;
}
export function credentialInsert(db,id,hash) {
 return stmt(db,'INSERT INTO account_credentials(user_id,password_hash,provisional) VALUES(?,?,0)',id,hash);
}
export function exactAccessCode(value,label) {
 if(typeof value!=='string'||!value.trim()||value.length>128)fail(`${label} requis.`);
 return value;
}
export async function validateRegistrationCodes(db,body) {
 const groupCode=exactAccessCode(body.groupCode,'Code du groupe');
 if(typeof body.coach!=='boolean')fail('Choix du rôle coach invalide.');
 const codes=await db.prepare('SELECT group_code,coach_code FROM group_access_codes WHERE id=1').first();
 if(!codes||groupCode!==codes.group_code)fail('Code du groupe invalide.',403);
 if(body.coach){
  const coachCode=exactAccessCode(body.coachCode,'Code coach');
  if(coachCode!==codes.coach_code)fail('Code coach invalide.',403);
 }
 return body.coach?'coach':'athlete';
}
export async function initializeCommunity(db) {
 await db.exec(schema);
 await stmt(db,"INSERT OR IGNORE INTO group_access_codes(id,group_code,coach_code) VALUES(1,'NOUVEAU','COACH')").run();
 // Capture the existing identifier once: later renaming must not change a provisional password.
 await db.prepare('INSERT OR IGNORE INTO account_credentials(user_id,initial_identifier) SELECT id,email FROM users').run();
 if(await db.prepare("SELECT value FROM meta WHERE key='community_v1'").first())return;
 const season=await stmt(db,"SELECT data FROM records WHERE collection='season' AND id=?",'2026-2027').first();
 const legacy=JSON.parse(season?.data||'{}').competitions||[];
 const entries=[];
 for(let i=0;i<legacy.length;i++){
  const c=legacy[i],id=`legacy-season-${i}`;
  const data={id,title:c.label,date:null,weekStart:seasonWeekDate(c.week),location:'',level:''};
  entries.push(stmt(db,'INSERT OR IGNORE INTO records(collection,id,data) VALUES(?,?,?)','competitions',id,JSON.stringify(data)));
 }
 const sessions=await db.prepare("SELECT data FROM records WHERE collection='sessions' AND archived=0 AND json_extract(data,'$.type')='competition'").all();
 for(const row of sessions.results){
  const s=JSON.parse(row.data),id=`session-${s.id}`;
  entries.push(stmt(db,'INSERT OR IGNORE INTO records(collection,id,data) VALUES(?,?,?)','competitions',id,JSON.stringify({id,title:s.title,date:s.date,weekStart:mondayOf(s.date),location:'',level:'',sourceSessionId:s.id})));
 }
 // A restart resumes incomplete imports through INSERT OR IGNORE; never replaces edited records.
 for(let i=0;i<entries.length;i+=40)await db.batch(entries.slice(i,i+40));
 await db.batch([db.prepare("INSERT OR IGNORE INTO meta VALUES ('community_v1',1)"),revision(db)]);
}
export async function communityState(db,ctx) {
 const [comments,signups,credentials,accessCodes]=await Promise.all([
  stmt(db,`SELECT c.session_id AS sessionId,c.user_id AS userId,c.rating,c.body,c.is_private AS isPrivate,c.version,c.updated,u.name,u.last_name AS lastName
   FROM session_comments c JOIN users u ON u.id=c.user_id JOIN records r ON r.collection='sessions' AND r.id=c.session_id AND r.archived=0
   WHERE c.is_private=0 OR c.user_id=? OR ?='coach' ORDER BY c.updated`,ctx.id,ctx.role).all(),
  db.prepare(`SELECT s.competition_id AS competitionId,s.user_id AS userId,u.name,u.last_name AS lastName,u.role FROM competition_signups s JOIN users u ON u.id=s.user_id JOIN records r ON r.collection='competitions' AND r.id=s.competition_id AND r.archived=0 ORDER BY u.name,u.last_name`).all(),
  credentialForUser(db,ctx),
  ctx.role==='admin'?db.prepare('SELECT group_code AS groupCode,coach_code AS coachCode,version FROM group_access_codes WHERE id=1').first():null
 ]);
 return {comments:comments.results.map(c=>({...c,isPrivate:!!c.isPrivate})),signups:signups.results,passwordVersion:credentials.version,passwordProvisional:!!credentials.provisional,...(accessCodes?{accessCodes}: {})};
}
async function activeRecord(db,collection,id) {
 const row=await stmt(db,'SELECT * FROM records WHERE collection=? AND id=? AND archived=0',collection,id).first();
 if(!row)fail('Élément introuvable.',404);
 return {...JSON.parse(row.data),version:row.version};
}
export async function communityAction(db,ctx,path,method,body) {
 if(path==='/api/access-codes'&&method==='PUT'){
  if(ctx.role!=='admin')fail('Action réservée aux administrateurs.',403);
  const groupCode=exactAccessCode(body.groupCode,'Code du groupe'),coachCode=exactAccessCode(body.coachCode,'Code coach');
  if(!Number.isInteger(body.version)||body.version<1)fail('Version des codes invalide.');
  const changed=await stmt(db,'UPDATE group_access_codes SET group_code=?,coach_code=?,version=version+1 WHERE id=1 AND version=?',groupCode,coachCode,body.version).run();
  if(!changed.meta.changes)fail('Les codes ont été modifiés par un autre admin. Rechargez les réglages.',409);
  await revision(db).run();
  return {ok:true};
 }
 if(path==='/api/account/coach'&&method==='PUT'){
  if(typeof body.coach!=='boolean'||!Number.isInteger(body.version))fail('Modification du rôle invalide.');
  const member=await stmt(db,'SELECT role,account_version FROM users WHERE id=?',ctx.id).first();
  if(member.role==='admin')fail('Le rôle admin se gère séparément des droits coach.',403);
  if(member.account_version!==body.version)fail('Votre compte a changé. Rechargez les réglages.',409);
  if((member.role==='coach')===body.coach)return {ok:true,role:member.role};
  const nextRole=body.coach?'coach':'athlete';
  let codeGuard='',codeParams=[];
  if(body.coach){
   const coachCode=exactAccessCode(body.coachCode,'Code coach');
   const codes=await db.prepare('SELECT coach_code FROM group_access_codes WHERE id=1').first();
   if(!codes||coachCode!==codes.coach_code)fail('Code coach invalide.',403);
   codeGuard=' AND EXISTS (SELECT 1 FROM group_access_codes WHERE id=1 AND coach_code=?)';
   codeParams=[coachCode];
  }
  const actions=[
   stmt(db,`INSERT INTO role_events(actor,member,previous_role,next_role,created) SELECT ?,id,role,?,? FROM users WHERE id=? AND account_version=? AND role=?${codeGuard}`,ctx.id,nextRole,Date.now(),ctx.id,body.version,member.role,...codeParams),
   stmt(db,`UPDATE users SET role=?,account_version=account_version+1 WHERE id=? AND account_version=? AND role=?${codeGuard}`,nextRole,ctx.id,body.version,member.role,...codeParams),
   revision(db)
  ];
  const results=await db.batch(actions);
  if(!results[1].meta.changes)fail(body.coach?'Le code coach a changé ou votre compte a été modifié. Rechargez puis réessayez.':'Votre compte a été modifié. Rechargez puis réessayez.',409);
  return {ok:true,role:nextRole};
 }
 const memberMatch=path.match(/^\/api\/members\/([^/]+)(?:\/(password|coach))?$/);
 if(memberMatch&&['PUT','DELETE'].includes(method)){
  if(ctx.role!=='admin')fail('Action réservée aux administrateurs.',403);
  const id=decodeURIComponent(memberMatch[1]),action=memberMatch[2];
  const member=await stmt(db,'SELECT * FROM users WHERE id=?',id).first();
  if(!member)fail('Membre introuvable.',404);
  if(member.account_version!==body.version)fail('Ce compte a changé. Rechargez la page.',409);
  const guard='EXISTS (SELECT 1 FROM users WHERE id=? AND account_version=?)';
  if(action==='password'&&method==='PUT'){
   const password=passwordValue(body.password),hash=await passwordHash(password);
   const results=await db.batch([
    stmt(db,`UPDATE account_credentials SET password_hash=?,initial_identifier=NULL,provisional=1,version=version+1 WHERE user_id=? AND ${guard}`,hash,id,id,body.version),
    stmt(db,`DELETE FROM auth WHERE user_id=? AND ${guard}`,id,id,body.version),
    stmt(db,'UPDATE users SET account_version=account_version+1 WHERE id=? AND account_version=?',id,body.version),revision(db)
   ]);
   if(!results[2].meta.changes)fail('Ce compte a changé. Rechargez la page.',409);
   return {ok:true,temporaryPassword:password};
  }
  if(action==='coach'&&method==='PUT'){
   if(member.role==='admin')fail('Retirez d’abord les droits admin de ce membre.');
   if(!['grant-coach','revoke-coach'].includes(body.action))fail('Action invalide.');
   const role=body.action==='grant-coach'?'coach':'athlete';
   const results=await db.batch([
    stmt(db,`INSERT INTO role_events(actor,member,previous_role,next_role,created) SELECT ?,id,role,?,? FROM users WHERE id=? AND account_version=?`,ctx.id,role,Date.now(),id,body.version),
    stmt(db,'UPDATE users SET role=?,account_version=account_version+1 WHERE id=? AND account_version=?',role,id,body.version),revision(db)
   ]);
   if(!results[1].meta.changes)fail('Ce compte a changé. Rechargez la page.',409);
   return {ok:true,role};
  }
  if(!action&&method==='DELETE'){
   if(body.confirm!==true||body.identifier!==member.email)fail('Confirmez avec l’identifiant exact du membre.');
   if(member.role==='admin'&&(await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first()).n<=1)fail('Le dernier administrateur ne peut pas être supprimé.',409);
   const deletionGuard="EXISTS (SELECT 1 FROM users WHERE id=? AND account_version=? AND (role<>'admin' OR (SELECT COUNT(*) FROM users WHERE role='admin')>1))";
   const actions=['auth','account_credentials','session_comments','competition_signups','account_created'].map(table=>stmt(db,`DELETE FROM ${table} WHERE user_id=? AND ${deletionGuard}`,id,id,body.version));
   actions.push(stmt(db,`DELETE FROM users WHERE id=? AND account_version=? AND (role<>'admin' OR (SELECT COUNT(*) FROM users WHERE role='admin')>1)`,id,body.version),revision(db));
   const results=await db.batch(actions);
   if(!results[actions.length-2].meta.changes)fail('Suppression impossible : compte modifié ou dernier admin.',409);
   return {ok:true};
  }
  fail('Route introuvable.',404);
 }
 if(path==='/api/password'&&method==='PUT'){
  const hash=await passwordHash(body.password);
  const changed=await stmt(db,'UPDATE account_credentials SET password_hash=?,initial_identifier=NULL,provisional=0,version=version+1 WHERE user_id=? AND version=?',hash,ctx.id,body.version).run();
  if(!changed.meta.changes)fail('Votre mot de passe a changé ailleurs. Rechargez la page.',409);
  await revision(db).run();return {ok:true};
 }
 const commentMatch=path.match(/^\/api\/sessions\/([^/]+)\/comment$/);
 if(commentMatch&&['PUT','DELETE'].includes(method)){
  const id=decodeURIComponent(commentMatch[1]);await activeRecord(db,'sessions',id);
  let changed;
  if(method==='DELETE')changed=await stmt(db,'DELETE FROM session_comments WHERE session_id=? AND user_id=? AND version=?',id,ctx.id,body.version).run();
  else {
   const rating=body.rating??null;
   if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))fail('Difficulté invalide.');
   if(typeof body.body!=='string'||body.body.length>4000||typeof body.isPrivate!=='boolean')fail('Commentaire invalide.');
   const text=body.body.trim();if(rating===null&&!text)fail('Ajoutez une difficulté ou un texte.');
   if(body.version===0)changed=await stmt(db,'INSERT OR IGNORE INTO session_comments(session_id,user_id,rating,body,is_private,updated) VALUES(?,?,?,?,?,?)',id,ctx.id,rating,text,Number(body.isPrivate),Date.now()).run();
   else changed=await stmt(db,'UPDATE session_comments SET rating=?,body=?,is_private=?,version=version+1,updated=? WHERE session_id=? AND user_id=? AND version=?',rating,text,Number(body.isPrivate),Date.now(),id,ctx.id,body.version).run();
  }
  if(!changed.meta.changes)fail('Votre commentaire a changé ailleurs. Fermez puis rouvrez cette fenêtre.',409);
  await revision(db).run();return {ok:true};
 }
 const match=path.match(/^\/api\/competitions(?:\/([^/]+))?(\/signup)?$/);
 if(!match)return null;
 const id=match[1]?decodeURIComponent(match[1]):null;
 if(id&&match[2]&&method==='PUT'){
  await activeRecord(db,'competitions',id);
  if(typeof body.registered!=='boolean')fail('Inscription invalide.');
  const action=body.registered?stmt(db,'INSERT OR IGNORE INTO competition_signups VALUES(?,?,?)',id,ctx.id,Date.now()):stmt(db,'DELETE FROM competition_signups WHERE competition_id=? AND user_id=?',id,ctx.id);
  await db.batch([action,revision(db)]);return {ok:true};
 }
 if(match[2])fail('Route introuvable.',404);
 if(method==='POST'&&!id){
  let data;try{data=competitionData(body);}catch(e){fail(e.message);}
  const item={...data,id:crypto.randomUUID(),version:1};
  await db.batch([stmt(db,'INSERT INTO records(collection,id,data) VALUES(?,?,?)','competitions',item.id,JSON.stringify(item)),revision(db)]);return item;
 }
 if(id&&['PUT','DELETE'].includes(method)){
  const old=await activeRecord(db,'competitions',id);
  if(old.version!==body.version)fail('Cette compétition a changé ailleurs. Fermez puis rouvrez le formulaire.',409);
  let item;
  if(method==='PUT'){let data;try{data=competitionData(body);}catch(e){fail(e.message);}item={...old,...data,version:old.version+1};}
  const action=method==='PUT'?stmt(db,'UPDATE records SET data=?,version=version+1 WHERE collection=? AND id=? AND version=?',JSON.stringify(item),'competitions',id,old.version):stmt(db,'UPDATE records SET archived=1,version=version+1 WHERE collection=? AND id=? AND version=?','competitions',id,old.version);
  const updated=await action.run();if(!updated.meta.changes)fail('Cette compétition a changé ailleurs. Rechargez la page.',409);
  await revision(db).run();return item||{ok:true};
 }
 fail('Route introuvable.',404);
}
export function removeMemberCommunity(db,id) {
 return ['account_credentials','session_comments','competition_signups','account_created'].map(table=>stmt(db,`DELETE FROM ${table} WHERE user_id=?`,id));
}
export async function syncSessionCompetition(db,session) {
 const id=`session-${session.id}`,row=await stmt(db,"SELECT * FROM records WHERE collection='competitions' AND id=?",id).first();
 if(session.type!=='competition')return;
 const previous=row?JSON.parse(row.data):{};
 const data={...previous,id,title:session.title,date:session.date,weekStart:mondayOf(session.date),location:previous.location||'',level:previous.level||'',sourceSessionId:session.id};
 if(row)await stmt(db,"UPDATE records SET data=?,version=version+1 WHERE collection='competitions' AND id=? AND archived=0",JSON.stringify(data),id).run();
 else await stmt(db,'INSERT INTO records(collection,id,data) VALUES(?,?,?)','competitions',id,JSON.stringify(data)).run();
}
