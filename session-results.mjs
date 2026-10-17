import {parseSessionTimes,normalizeSessionDistances} from './session-results-core.mjs';
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const canCoach=user=>user?.role==='coach'||(user?.role==='admin'&&!!user.coachEnabled);
export const resultsSchema=`
CREATE TABLE IF NOT EXISTS admin_coach_access (user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS session_results (session_id TEXT NOT NULL,user_id TEXT NOT NULL,raw_text TEXT NOT NULL,times_json TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL,PRIMARY KEY(session_id,user_id));
CREATE TABLE IF NOT EXISTS session_result_distances (session_id TEXT NOT NULL,user_id TEXT NOT NULL,distances_json TEXT NOT NULL,PRIMARY KEY(session_id,user_id));`;
export async function sessionResultsState(db,ctx) {
 const rows=await stmt(db,`SELECT t.*,d.distances_json,u.name,u.last_name AS lastName,r.data,r.archived FROM session_results t JOIN users u ON u.id=t.user_id JOIN records r ON r.collection='sessions' AND r.id=t.session_id LEFT JOIN session_result_distances d ON d.session_id=t.session_id AND d.user_id=t.user_id WHERE t.user_id=? OR ?=1 ORDER BY json_extract(r.data,'$.date') DESC,u.name,u.last_name`,ctx.id,Number(canCoach(ctx))).all();
 return rows.results.map(row=>{
  const s=JSON.parse(row.data);
  const session=Object.fromEntries(['id','date','title','type','slot','warmup','workout','v2'].map(key=>[key,s[key]||'']));
  const times=JSON.parse(row.times_json),distances=row.distances_json?JSON.parse(row.distances_json):times.map(()=>null);
  return {sessionId:row.session_id,userId:row.user_id,name:row.name,lastName:row.lastName,rawText:row.raw_text,times,distances,version:row.version,updated:row.updated,session:{...session,archived:!!row.archived}};
 });
}
export async function sessionResultsAction(db,ctx,path,method,body) {
 const match=path.match(/^\/api\/sessions\/([^/]+)\/times$/);
 if(!match||!['PUT','DELETE'].includes(method))return null;
 const id=decodeURIComponent(match[1]);
 const row=await stmt(db,"SELECT data,archived FROM records WHERE collection='sessions' AND id=?",id).first();
 if(!row)fail('Séance introuvable.',404);
 if(['rest','strength'].includes(JSON.parse(row.data).type))fail('Les chronos de séance ne concernent pas les jours de repos ou la musculation.');
 if(!Number.isInteger(body.version)||body.version<0)fail('Version invalide.');
 if(row.archived&&body.version===0)fail('Cette séance est archivée : seuls les chronos déjà saisis peuvent être corrigés.',409);
 const old=await stmt(db,'SELECT t.version,t.times_json,d.distances_json FROM session_results t LEFT JOIN session_result_distances d ON d.session_id=t.session_id AND d.user_id=t.user_id WHERE t.session_id=? AND t.user_id=?',id,ctx.id).first();
 if((old?.version||0)!==body.version)fail('Vos chronos ont changé ailleurs. Rechargez la page avant de réessayer.',409);
 let action,detail;
 if(method==='DELETE'){
  detail=stmt(db,'DELETE FROM session_result_distances WHERE session_id=? AND user_id=? AND EXISTS (SELECT 1 FROM session_results WHERE session_id=? AND user_id=? AND version=?)',id,ctx.id,id,ctx.id,body.version);
  action=stmt(db,'DELETE FROM session_results WHERE session_id=? AND user_id=? AND version=?',id,ctx.id,body.version);
 }
 else {
  let times;try{times=parseSessionTimes(body.rawText);}catch(e){fail(e.message);}
  const previous=old?.distances_json?JSON.parse(old.distances_json):[];
  if(body.distances===undefined&&previous.some(d=>d!==null)&&previous.length!==times.length)fail('Rechargez la page pour adapter les distances au nombre de chronos.',409);
  let distances;try{distances=normalizeSessionDistances(body.distances===undefined?(previous.length===times.length?previous:times.map(()=>null)):body.distances,times.length);}catch(e){fail(e.message);}
  const guard=body.version===0?'NOT EXISTS (SELECT 1 FROM session_results WHERE session_id=? AND user_id=?)':'EXISTS (SELECT 1 FROM session_results WHERE session_id=? AND user_id=? AND version=?)';
  detail=stmt(db,`INSERT INTO session_result_distances(session_id,user_id,distances_json) SELECT ?,?,? WHERE ${guard} ON CONFLICT(session_id,user_id) DO UPDATE SET distances_json=excluded.distances_json`,id,ctx.id,JSON.stringify(distances),id,ctx.id,...(body.version===0?[]:[body.version]));
  const rawText=body.rawText.trim();
  action=body.version===0?
   stmt(db,'INSERT OR IGNORE INTO session_results(session_id,user_id,raw_text,times_json,updated) VALUES(?,?,?,?,?)',id,ctx.id,rawText,JSON.stringify(times),Date.now()):
   stmt(db,'UPDATE session_results SET raw_text=?,times_json=?,version=version+1,updated=? WHERE session_id=? AND user_id=? AND version=?',rawText,JSON.stringify(times),Date.now(),id,ctx.id,body.version);
 }
 const [,changed]=await db.batch([detail,action,db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'")]);
 if(!changed.meta.changes)fail('Vos chronos ont changé ailleurs. Rechargez la page avant de réessayer.',409);
 return {ok:true};
}
