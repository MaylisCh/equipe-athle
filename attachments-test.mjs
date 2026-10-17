import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteD1} from './sqlite-d1.mjs';
import {xlsxFixture} from './attachment-fixtures.mjs';
import {attachmentData,MAX_ATTACHMENT_BYTES} from './session-attachments.mjs';
import {normalizeSearch,memberMatches} from './search-core.mjs';
import {unzipXlsx} from './session-upload.mjs';

test('Recherche sans accents, casse, ordre des noms, ligatures ou traits d’union',()=>{
 assert.equal(normalizeSearch('Élodie Cœur'),'elodie coeur');
 const member={name:'Élodie Anne-Marie',lastName:'D’Hôtel',email:'élodie-puc'};
 for(const query of ['elodie','ELODIE','hotel elodie','anne marie','d hotel',''])assert.equal(memberMatches(member,query),true);
 assert.equal(memberMatches(member,'puc'),false);assert.equal(memberMatches(member,'puc',true),true);assert.equal(memberMatches(member,'inconnu'),false);
});
test('Fichiers Excel : validation, signatures, noms et taille',()=>{
 const data={filename:'Muscu.xlsx',contentBase64:xlsxFixture().toString('base64')};assert.equal(attachmentData(data).size,xlsxFixture().length);
 for(const change of [{filename:'../muscu.xlsx'},{filename:'fichier.html'},{contentBase64:'abc'},{contentBase64:Buffer.from('pas un excel').toString('base64')},{contentBase64:Buffer.alloc(MAX_ATTACHMENT_BYTES+1).toString('base64')}])assert.throws(()=>attachmentData({...data,...change}));
});
test('Décompression bornée et vérification des tailles annoncées du classeur',async()=>{
 const bytes=xlsxFixture(),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 assert.ok((await unzipXlsx(buffer)).has('xl/workbook.xml'));
 const bad=Buffer.from(bytes);let at=0;while((at=bad.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]),at))!==-1){const length=bad.readUInt16LE(at+28),name=bad.subarray(at+46,at+46+length).toString();if(name==='xl/workbook.xml'){bad.writeUInt32LE(1,at+24);break;}at+=46+length;}
 await assert.rejects(unzipXlsx(bad.buffer.slice(bad.byteOffset,bad.byteOffset+bad.byteLength)));
});
test('Pages : fichiers privés, gestion coach, remplacement, téléchargement exact, muscu sans chronos et migration',async t=>{
 const native=new DatabaseSync(':memory:'),DB=sqliteD1(native);t.after(()=>native.close());
 const source=readFileSync(new URL('./functions/api/[[path]].js',import.meta.url),'utf8').replace("import seed from '../../seed.json';",`const seed=${readFileSync(new URL('./seed.json',import.meta.url),'utf8')};`).replace(/from '\.\.\/\.\.\/([^']+)'/g,(_,path)=>`from '${new URL(path,import.meta.url).href}'`);
 const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const request=async(path,method='GET',body,who)=>{const response=await onRequest({env:{DB},request:new Request('https://equipe.test/api'+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who.accessToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})});return {status:response.status,json:await response.json()};};
 await request('/auth');const admin=(await request('/setup','POST',{email:'maylis',name:'Maylis',password:'x'})).json;
 const register=async(email,coach)=>(await request('/register','POST',{email,name:email,password:'x',coach,groupCode:'NOUVEAU',coachCode:'COACH'})).json;
 const coach=await register('Coach',true),athlete=await register('Élodie',false),state=async who=>(await request('/state','GET',undefined,who)).json;
 const strength=(await request('/sessions','POST',{title:'Musculation',date:'2030-05-13',type:'strength',targets:[]},coach)).json;
 const speed=(await request('/sessions','POST',{title:'Vitesse',date:'2030-05-13',type:'speed',targets:[]},coach)).json;
 const bytes=xlsxFixture(),body={filename:'Muscu.xlsx',contentBase64:bytes.toString('base64')},upload='/sessions/'+strength.id+'/attachments';
 assert.equal((await request(upload,'POST',body)).status,401);assert.equal((await request(upload,'POST',body,athlete)).status,403);assert.equal((await request(upload,'POST',body,admin)).status,403);
 assert.equal((await request('/sessions/'+speed.id+'/attachments','POST',body,coach)).status,400);
 assert.equal((await request(upload,'POST',body,coach)).status,201);
 const file=(await state(athlete)).attachments.find(a=>a.sessionId===strength.id);assert.ok(file);assert.equal('contentBase64' in file,false);assert.equal(file.size,bytes.length);
 assert.equal((await request('/attachments/'+file.id)).status,401);
 const download=await request('/attachments/'+file.id,'GET',undefined,athlete);assert.equal(download.status,200);assert.deepEqual(Buffer.from(download.json.contentBase64,'base64'),bytes);
 for(const who of [athlete,admin]){assert.equal((await request('/attachments/'+file.id,'DELETE',{version:1},who)).status,403);assert.equal((await request('/attachments/'+file.id,'PUT',{...body,version:1},who)).status,403);}
 const replaced=xlsxFixture('Nouvelle séance');assert.equal((await request('/attachments/'+file.id,'PUT',{filename:'Nouveau.xlsx',contentBase64:replaced.toString('base64'),version:1},coach)).status,200);
 assert.equal((await request('/attachments/'+file.id,'DELETE',{version:1},coach)).status,409);
 assert.deepEqual(Buffer.from((await request('/attachments/'+file.id,'GET',undefined,athlete)).json.contentBase64,'base64'),replaced);
 const {initializeCommunity}=await import('./community.mjs');await initializeCommunity(DB);assert.equal((await state(athlete)).attachments.find(a=>a.id===file.id).version,2);
 assert.equal((await request('/sessions/'+strength.id+'/times','PUT',{rawText:'25',version:0},athlete)).status,400);
 for(let i=0;i<4;i++)assert.equal((await request(upload,'POST',body,coach)).status,201);
 assert.equal((await request(upload,'POST',body,coach)).status,409);
 assert.equal((await request('/account/coach','PUT',{coach:true,version:1},admin)).status,200);
 assert.equal((await request('/attachments/'+file.id,'DELETE',{version:2},admin)).status,200);assert.equal((await request('/attachments/'+file.id,'GET',undefined,athlete)).status,404);
 assert.equal((await request('/account','DELETE',{identifier:'Coach',confirm:true},coach)).status,200);assert.equal((await state(athlete)).attachments.filter(a=>a.sessionId===strength.id).length,4,'Documents are shared, not deleted with their author');
 // Exercise the larger upload body and D1 row bound without using external files.
 const large=Buffer.alloc(100000);bytes.copy(large);assert.equal((await request(upload,'POST',{filename:'Plus grand.xlsx',contentBase64:large.toString('base64')},admin)).status,201);
});
