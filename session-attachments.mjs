import {canCoach} from './session-results.mjs';
export const MAX_ATTACHMENT_BYTES=100*1024;
export const MAX_SESSION_ATTACHMENTS=5;
export const attachmentsSchema=`
CREATE TABLE IF NOT EXISTS session_attachments (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,content_base64 TEXT NOT NULL,created INTEGER NOT NULL,created_by TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS session_attachments_session ON session_attachments(session_id);`;
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const columns='a.id,a.session_id AS sessionId,a.filename,a.mime,a.size,a.created,a.version';
export async function attachmentsState(db){
 return (await db.prepare(`SELECT ${columns} FROM session_attachments a JOIN records r ON r.collection='sessions' AND r.id=a.session_id AND r.archived=0 ORDER BY a.created,a.id`).all()).results;
}
export function attachmentData(body){
 const filename=body.filename;
 if(typeof filename!=='string'||!filename.trim()||filename.length>180||/[\\/\u0000-\u001f]/.test(filename)||!/^.+\.(xlsx|xls)$/i.test(filename))fail('Choisissez un fichier Excel .xlsx ou .xls.');
 const encoded=body.contentBase64;
 if(typeof encoded!=='string'||encoded.length>Math.ceil(MAX_ATTACHMENT_BYTES/3)*4||!encoded.length||encoded.length%4||! /^[A-Za-z0-9+/]*={0,2}$/.test(encoded))fail('Fichier Excel invalide ou trop volumineux (100 Ko maximum).');
 let bytes;try{bytes=atob(encoded);}catch{fail('Fichier Excel invalide.');}
 if(bytes.length>MAX_ATTACHMENT_BYTES||bytes.length<8)fail('Fichier Excel invalide ou trop volumineux (100 Ko maximum).');
 const xlsx=/\.xlsx$/i.test(filename),signature=xlsx?'PK\x03\x04':'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1';
 if(!bytes.startsWith(signature))fail('Le contenu ne correspond pas à un fichier Excel valide.');
 return {filename,mime:xlsx?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.ms-excel',size:bytes.length,contentBase64:encoded};
}
export async function attachmentAction(db,ctx,path,method,body){
 const upload=path.match(/^\/api\/sessions\/([^/]+)\/attachments$/),file=path.match(/^\/api\/attachments\/([^/]+)$/);
 if(!upload&&!file)return null;
 const id=decodeURIComponent((upload||file)[1]);
 let existing;
 if(file){
  existing=await stmt(db,'SELECT * FROM session_attachments WHERE id=?',id).first();
  if(!existing)fail('Ce fichier n’est plus disponible.',404);
  if(method==='GET')return {id,sessionId:existing.session_id,filename:existing.filename,mime:existing.mime,size:existing.size,version:existing.version,contentBase64:existing.content_base64};
 }
 if(!canCoach(ctx))fail('Seuls les coachs peuvent gérer les fichiers des séances.',403);
 if(upload&&method!=='POST'||file&&!['PUT','DELETE'].includes(method))fail('Route introuvable.',404);
 if(file&&body.version!==existing.version)fail('Le fichier a changé ailleurs. Rechargez la page.',409);
 const sessionId=upload?id:existing.session_id;
 if(method==='DELETE'){
  const result=await stmt(db,'DELETE FROM session_attachments WHERE id=? AND version=?',id,body.version).run();
  if(!result.meta.changes)fail('Ce fichier a changé ailleurs. Rechargez la page.',409);
 }else{
  const session=await stmt(db,"SELECT data FROM records WHERE collection='sessions' AND id=? AND archived=0",sessionId).first();
  if(!session)fail('Séance introuvable.',404);
  if(JSON.parse(session.data).type!=='strength')fail('Les fichiers Excel sont réservés aux séances de musculation.');
  const data=attachmentData(body),now=Date.now();
  const guard="EXISTS (SELECT 1 FROM records WHERE collection='sessions' AND id=? AND archived=0 AND json_extract(data,'$.type')='strength')";
  const result=upload?
   await stmt(db,`INSERT INTO session_attachments(id,session_id,filename,mime,size,content_base64,created,created_by) SELECT ?,?,?,?,?,?,?,? WHERE ${guard} AND (SELECT COUNT(*) FROM session_attachments WHERE session_id=?)<?`,crypto.randomUUID(),sessionId,data.filename,data.mime,data.size,data.contentBase64,now,ctx.id,sessionId,sessionId,MAX_SESSION_ATTACHMENTS).run():
   await stmt(db,`UPDATE session_attachments SET filename=?,mime=?,size=?,content_base64=?,created=?,created_by=?,version=version+1 WHERE id=? AND version=? AND ${guard}`,data.filename,data.mime,data.size,data.contentBase64,now,ctx.id,id,body.version,sessionId).run();
  if(!result.meta.changes)fail(upload?'La séance a changé ou contient déjà 5 fichiers.':'Le fichier ou la séance a changé. Rechargez la page.',409);
 }
 await db.prepare("UPDATE meta SET value=value+1 WHERE key='revision'").run();
 return {ok:true};
}
