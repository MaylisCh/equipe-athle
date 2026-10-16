import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const origin='http://localhost:18790',data=mkdtempSync(join(tmpdir(),'athle-results-'));
const server=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,ATHLE_DATA_DIR:data,PORT:'18790',APP_ORIGIN:origin,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let browser,logs='';const errors=[];server.stderr.on('data',b=>logs+=b);server.stdout.on('data',b=>logs+=b);
try{
 for(let i=0;i<100;i++){try{await fetch(origin+'/api/auth');break;}catch{}if(i===99)throw new Error(logs);await new Promise(r=>setTimeout(r,50));}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'fr-FR',timezoneId:'Europe/Paris'});
 const newPage=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
 const nav=async(p,hash)=>{await p.locator(`#navigation a[href="#${hash}"]`).click();};
 const admin=await newPage();await admin.goto(origin+'/#initialisation');await admin.locator('[name=password]').fill('admin');await admin.getByRole('button',{name:'Activer mon compte admin'}).click();await expect(admin.locator('#daily-sessions')).toBeVisible();
 await expect(admin.locator('#navigation a[href="#chronos"]')).toHaveText('◷ Allures');await nav(admin,'chronos');await expect(admin.getByRole('heading',{name:'Allures.',exact:true})).toBeVisible();
 await nav(admin,'reglages');await expect(admin.locator('#self-coach-form')).toBeVisible();await admin.locator('#self-coach-form [name=coach]').check();await admin.getByRole('button',{name:'Enregistrer mon rôle'}).click();await expect(admin.locator('#self-coach-form [name=coach]')).toBeChecked();await expect(admin.getByRole('heading',{name:'Gestion des membres'})).toBeVisible();
 await nav(admin,'entrainements');await expect(admin.getByRole('button',{name:'+ Séance',exact:true})).toBeVisible();
 await admin.getByRole('button',{name:'+ Séance',exact:true}).click();await admin.locator('#editor [name=title]').fill('Résultats 3 x 200');await admin.locator('#editor [name=date]').fill('2030-05-13');await admin.locator('#editor [name=workout]').fill('3 × 200 m avec récupération');await admin.getByRole('button',{name:'Enregistrer pour l’équipe',exact:true}).click();await expect(admin.locator('#editor')).not.toBeVisible();
 const register=async(name)=>{
  const p=await newPage();await p.goto(origin+'/#inscription');await p.locator('[name=name]').fill(name);await p.locator('[name=email]').fill(name);await p.locator('[name=password]').fill('x');await p.locator('[name=groupCode]').fill('NOUVEAU');await p.getByRole('button',{name:'Créer mon compte'}).click();await expect(p.locator('#daily-sessions')).toBeVisible();return p;
 };
 const alice=await register('Alice'),bob=await register('Bob');
 for(const [p,raw] of [[alice,'25,4 - 25.8 / 26 ; 1:02,5'],[bob,'30 / 31']]){
  await nav(p,'chrono-seance');await p.locator('#times-date').fill('2030-05-13');await p.locator('#session-times-form [name=rawText]').fill(raw);await p.locator('#session-times-form button[type=submit]').click();await expect(p.locator('#toast')).toHaveText('Vos chronos de séance sont enregistrés.');
 }
 await expect(alice.locator('#times-details')).toContainText('Alice');await expect(alice.locator('#times-details')).not.toContainText('Bob');for(const time of ['25,40 s','25,80 s','26,00 s','1:02,50'])await expect(alice.locator('#times-details')).toContainText(time);
 await alice.locator('#times-details [data-edit-times]').click();await alice.locator('#editor [name=rawText]').fill('25,5 ; 25.9');await alice.locator('#editor button[type=submit]').click();await expect(alice.locator('#times-details')).toContainText('25,50 s');
 await nav(admin,'chrono-seance');await admin.locator('#times-date').fill('2030-05-13');await admin.getByRole('button',{name:'Actualiser les résultats'}).click();await expect(admin.locator('#times-details')).toContainText('Alice');await expect(admin.locator('#times-details')).toContainText('Bob');
 await admin.locator('#session-times-form [name=rawText]').fill('28.5 / 29');await admin.locator('#session-times-form button[type=submit]').click();await expect(admin.locator('#times-details')).toContainText('Maylis');await expect(admin.locator('#times-details [data-edit-times]')).toHaveCount(1);
 await admin.getByRole('button',{name:'Semaine suivante des chronos'}).click();await expect(admin.locator('#times-date')).toHaveValue('2030-05-20');await admin.getByRole('button',{name:'Jour renseigné précédent'}).click();await expect(admin.locator('#times-date')).toHaveValue('2030-05-13');
 await admin.locator('#times-details summary').first().click();await expect(admin.locator('#times-details')).toContainText('3 × 200 m avec récupération');
 await alice.locator('#times-details a[href="#entrainements"]').click();await expect(alice.locator('#daily-sessions')).toContainText('Résultats 3 x 200');await alice.locator('#daily-sessions [data-times-session]').first().click();await expect(alice.locator('#times-details')).toContainText('25,50 s');
 await nav(admin,'reglages');await admin.locator('#self-coach-form [name=coach]').uncheck();await admin.getByRole('button',{name:'Enregistrer mon rôle'}).click();await expect(admin.locator('#self-coach-form [name=coach]')).not.toBeChecked();await expect(admin.getByRole('heading',{name:'Gestion des membres'})).toBeVisible();await nav(admin,'chrono-seance');await admin.locator('#times-date').fill('2030-05-13');await expect(admin.locator('#times-details')).not.toContainText('Alice');await expect(admin.locator('#times-details')).toContainText('Maylis');
 await alice.setViewportSize({width:390,height:844});await expect(alice.locator('#times-details')).toBeVisible();assert.equal(await alice.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 mkdirSync(join(import.meta.dirname,'test-results'),{recursive:true});await alice.screenshot({path:join(import.meta.dirname,'test-results/chrono-seance-mobile.png'),fullPage:true});
 await admin.setViewportSize({width:1440,height:1100});await admin.screenshot({path:join(import.meta.dirname,'test-results/chrono-seance-admin.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('Navigateur OK : admin + coach, Allures, saisie/édition personnelle, groupe, confidentialité, liens planning, semaines et mobile.');
}finally{await browser?.close();if(server.exitCode===null){const stopped=once(server,'exit');server.kill('SIGTERM');await stopped;}}
