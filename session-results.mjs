import {parseSessionTimes} from './session-results-core.mjs';
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const canCoach=user=>user?.role==='coach'||(user?.role==='admin'&&!!user.coachEnabled);
export const resultsSchema=`
CREATE TABLE IF NOT EXISTS admin_coach_access (user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS session_results (session_id TEXT NOT NULL,user_id TEXT NOT NULL,raw_text TEXT NOT NULL,times_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,PRIMARY KEY(session_id,user_id));`;
export async function sessionResultsState(db,ctx) {
 const rows=await stmt(db,`SELECT t.*,u.name,u.last_name AS lastName,r.data,r.archived FROM session_results t JOIN users u ON u.id=t.user_id JOIN records r ON r.collection='sessions' AND r.id=t.session_id WHERE t.user_id=? OR ?=1 ORDER BY json_extract(r.data,'$.date') DESC,u.name,u.last_name`,ctx.id,Number(canCoach(ctx))).all();
 return rows.results.map(row=>{
  const s=JSON.parse(row.data);
  const session=Object.fromEntries(['id','date','title','type','slot','warmup','workout','v2'].map(key=>[key,s[key]||'']));
  return {sessionId:row.session_id,userId:row.user_id,name:row.name,lastName:row.lastName,rawText:row.raw_text,times:JSON.parse(row.times_json),version:row.version,updated:row.updated,session:{...session,archived:!!row.archived}};
 });
}
export async function sessionResultsAction(db,ctx,path,method,body) {
 const match=path.match(/^\/api\/sessions\/([^/]+)\/times$/);
 if(!match||!['PUT','DELETE'].includes(method))return null;
 const id=decodeURIComponent(match[1]);
 const row=await stmt(db,"SELECT data,archived FROM records WHERE collection='sessions' AND id=?",id).first();
 if(!row)fail('Séance introuvable.',404);
 if(JSON.parse(row.data).type==='rest')fail('Choisissez une séance, pas un jour de repos.');
 if(!Number.isInteger(body.version)||body.version<0)fail('Version invalide.');
 if(row.archived&&body.version===0)fail('Cette séance est archivée : seuls les chronos déjà saisis peuvent être corrigés.',409);
 let changed;
 if(method==='DELETE')changed=await stmt(db,'DELETE FROM session_results WHERE session_id=? AND user_id=? AND version=?',id,ctx.id,body.version).run();
 else {
  let times;try{times=parseSessionTimes(body.rawText);}catch(e){fail(e.message);}
  const rawText=body.rawText.trim();
  changed=body.version===0?
   await stmt(db,'INSERT OR IGNORE INTO session_results(session_id,user_id,raw_text,times_json,updated) VALUES(?,?,?,?,?)',id,ctx.id,rawText,JSON.stringify(times),Date.now()).run():
   await stmt(db,'UPDATE session_results SET raw_text=?,times_json=?,version=version+1,updated=? WHERE session_id=? AND user_id=? AND version=?',rawText,JSON.stringify(times),Date.now(),id,ctx.id,body.version).run();
 }
 if(!changed.meta.changes)fail('Vos chronos ont changé ailleurs. Rechargez la page avant de réessayer.',409);
 await db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();
 return {ok:true};
}
