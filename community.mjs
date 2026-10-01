import { competitionData, mondayOf } from './community-core.mjs';
import { seasonWeekDate } from './season.mjs';

const schema=`
CREATE TABLE IF NOT EXISTS account_credentials (user_id TEXT PRIMARY KEY, password_hash TEXT, initial_identifier TEXT, provisional INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1);
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
export async function initializeCommunity(db) {
 await db.exec(schema);
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
 const [comments,signups,credentials]=await Promise.all([
  stmt(db,`SELECT c.session_id AS sessionId,c.user_id AS userId,c.rating,c.body,c.is_private AS isPrivate,c.version,c.updated,u.name,u.last_name AS lastName
   FROM session_comments c JOIN users u ON u.id=c.user_id JOIN records r ON r.collection='sessions' AND r.id=c.session_id AND r.archived=0
   WHERE c.is_private=0 OR c.user_id=? OR ?='coach' ORDER BY c.updated`,ctx.id,ctx.role).all(),
  db.prepare(`SELECT s.competition_id AS competitionId,s.user_id AS userId,u.name,u.last_name AS lastName,u.role FROM competition_signups s JOIN users u ON u.id=s.user_id JOIN records r ON r.collection='competitions' AND r.id=s.competition_id AND r.archived=0 ORDER BY u.name,u.last_name`).all(),
  credentialForUser(db,ctx)
 ]);
 return {comments:comments.results.map(c=>({...c,isPrivate:!!c.isPrivate})),signups:signups.results,passwordVersion:credentials.version,passwordProvisional:!!credentials.provisional};
}
async function activeRecord(db,collection,id) {
 const row=await stmt(db,'SELECT * FROM records WHERE collection=? AND id=? AND archived=0',collection,id).first();
 if(!row)fail('Élément introuvable.',404);
 return {...JSON.parse(row.data),version:row.version};
}
export async function communityAction(db,ctx,path,method,body) {
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
 return ['account_credentials','session_comments','competition_signups'].map(table=>stmt(db,`DELETE FROM ${table} WHERE user_id=?`,id));
}
export async function syncSessionCompetition(db,session) {
 const id=`session-${session.id}`,row=await stmt(db,"SELECT * FROM records WHERE collection='competitions' AND id=?",id).first();
 if(session.type!=='competition')return;
 const previous=row?JSON.parse(row.data):{};
 const data={...previous,id,title:session.title,date:session.date,weekStart:mondayOf(session.date),location:previous.location||'',level:previous.level||'',sourceSessionId:session.id};
 if(row)await stmt(db,"UPDATE records SET data=?,version=version+1 WHERE collection='competitions' AND id=? AND archived=0",JSON.stringify(data),id).run();
 else await stmt(db,'INSERT INTO records(collection,id,data) VALUES(?,?,?)','competitions',id,JSON.stringify(data)).run();
}
