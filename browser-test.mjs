import { chromium } from '@playwright/test';
import { expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const origin='http://localhost:18788', data=mkdtempSync(join(tmpdir(),'athle-browser-'));
const server=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,ATHLE_DATA_DIR:data,PORT:'18788',APP_ORIGIN:origin,HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let log='',browser;server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const errors=[];
mkdirSync(join(import.meta.dirname,'test-results'),{recursive:true});
try {
 for(let i=0;i<100;i++){try{await fetch(origin+'/api/auth');break;}catch{}if(i===99)throw new Error(log);await delay(50);}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'fr-FR',timezoneId:'Europe/Paris'});
 await context.addInitScript(()=>{
  const ActualDate=Date;window.Date=class extends ActualDate{constructor(...args){super(...(args.length?args:['2026-09-29T12:00:00+02:00']));}static now(){return +new ActualDate('2026-09-29T12:00:00+02:00');}};
 });
 const newPage=async()=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p;};
 const nav=async(p,hash)=>{await p.locator(`#navigation a[href="#${hash}"]`).click();};
 const admin=await newPage();await admin.goto(origin);
 await expect(admin.locator('.brand-logo')).toBeVisible();
 assert.equal(await admin.locator('.brand-logo').evaluate(img=>img.complete&&img.naturalWidth===300),true,'Le logo du PUC doit se charger');
 assert.equal((await (await fetch(origin+'/puc-logo.png')).headers.get('content-type')).split(';')[0],'image/png');
 await admin.getByRole('link',{name:'Maylis : activer mon compte admin'}).click();
 await expect(admin.locator('[name=name]')).toHaveValue('Maylis');await expect(admin.locator('[name=lastName]')).toHaveValue('Chancerelle');
 await admin.getByRole('button',{name:'Activer mon compte admin'}).click();
 await expect(admin.locator('#daily-sessions')).toBeVisible();await expect(admin.getByRole('button',{name:'+ Séance',exact:true})).toHaveCount(0);
 const coach=await newPage();await coach.goto(origin+'/#inscription');await coach.locator('[name=coach]').check();
 await coach.locator('[name=name]').fill('Coach Test');await coach.locator('[name=lastName]').fill('Club');await coach.locator('[name=email]').fill('coach-test');await coach.getByRole('button',{name:'Créer mon compte'}).click();await expect(coach.getByRole('button',{name:'+ Séance',exact:true})).toBeVisible();
 await coach.locator('.timeline-load[data-season-week="5"]').click();await coach.locator('#editor [name=seasonLoad]').selectOption('high');await coach.locator('#editor').getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(coach.locator('.timeline-load[data-season-week="5"]')).toContainText('élevée');
 await coach.locator('.timeline-load[data-season-week="105"]').click();await coach.locator('#editor [name=seasonLoad]').selectOption('medium');await coach.locator('#editor').getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(coach.locator('.timeline-load[data-season-week="105"]')).toContainText('moyenne');
 await coach.getByRole('button',{name:'+ Ajouter un repère'}).click();await coach.locator('#editor [name=seasonCategory]').selectOption('seasonNotes');await coach.locator('#editor [name=seasonStart]').selectOption('5');await coach.locator('#editor [name=seasonEnd]').selectOption('5');await coach.locator('#editor [name=seasonLabel]').fill('Repère ajouté par le coach');await coach.locator('#editor').getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(coach.locator('.timeline-stage')).toContainText(['Repère ajouté par le coach','Stage','Noël + NA']);
 await coach.locator('.timeline-stage').filter({hasText:'Repère ajouté par le coach'}).click();await coach.locator('#editor [name=seasonLabel]').fill('Repère mis à jour par le coach');await coach.locator('#editor').getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(coach.locator('.timeline-stage')).toContainText(['Repère mis à jour par le coach','Stage','Noël + NA']);
 const athlete=await newPage();await athlete.goto(origin+'/#inscription');await athlete.locator('[name=name]').fill('Camille');await athlete.locator('[name=lastName]').fill('Martin');await athlete.locator('[name=phone]').fill('0600000000');await athlete.locator('[name=email]').fill('camille');
 await expect(athlete.locator('[name=coach]')).not.toBeChecked();await athlete.getByRole('button',{name:'Créer mon compte'}).click();await expect(athlete.locator('#daily-sessions')).toBeVisible();
 await expect(athlete).toHaveTitle(/Équipe 400\/4H/);await expect(athlete.locator('.brand')).toContainText('Équipe 400/4H');
 assert.equal(await athlete.evaluate(()=>!!(document.querySelector('.month-calendar').compareDocumentPosition(document.querySelector('.season-overview'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'Le calendrier mensuel précède la frise.');
 await expect(athlete.locator('.season-overview summary')).toHaveText('La planification en un coup d’œil');
 await athlete.getByRole('button',{name:'Semaine suivante'}).click();await expect(athlete.locator('.page-intro .eyebrow')).toContainText('mardi 6 octobre 2026');
 await athlete.getByRole('button',{name:'Semaine précédente'}).click();await expect(athlete.locator('.page-intro .eyebrow')).toContainText('mardi 29 septembre 2026');
 await expect(athlete.locator('.timeline-general')).toHaveCount(3);await expect(athlete.locator('.timeline-training')).toHaveCount(4);await expect(athlete.locator('.timeline-holiday')).toHaveCount(3);await expect(athlete.locator('.timeline-competition')).toHaveCount(7);
 await expect(athlete.locator('.calendar-week')).toHaveCount(5);await expect(athlete.locator('.timeline-stage')).toContainText(['Repère mis à jour par le coach','Stage','Noël + NA']);await expect(athlete.locator('.timeline-load').filter({hasText:'élevée'})).not.toHaveCount(0);
 const timelineAlignment=await athlete.evaluate(()=>{
  const x=selector=>document.querySelector(selector).getBoundingClientRect().x;
  const stage=[...document.querySelectorAll('.timeline-stage')].find(element=>element.textContent.trim()==='Stage');
  const lastCompetition=[...document.querySelectorAll('.timeline-competition')].at(-1);
  return {week7:x('.timeline-week[data-week="7"]'),development:x('.timeline-general.tone-developpement'),stage:stage.getBoundingClientRect().x,week17:x('.timeline-week[data-week="17"]'),lastCompetition:lastCompetition.getBoundingClientRect().x,week27:x('.timeline-week[data-week="27"]')};
 });
 assert.ok(timelineAlignment.development<=timelineAlignment.week7&&timelineAlignment.week7<timelineAlignment.development+13*82,JSON.stringify(timelineAlignment));
 assert.ok(Math.abs(timelineAlignment.stage-timelineAlignment.week17)<2,JSON.stringify(timelineAlignment));
 assert.ok(Math.abs(timelineAlignment.lastCompetition-timelineAlignment.week27)<2,JSON.stringify(timelineAlignment));
 await expect(athlete.locator('.variant')).toBeVisible();await expect(athlete.getByRole('button',{name:/V2|Version 2/})).toHaveCount(0);await expect(athlete.getByRole('button',{name:/Modifier|Séance/})).toHaveCount(0);
 await athlete.locator('.timeline-week[data-week="105"]').click();await expect(athlete.locator('.month-calendar h2')).toContainText('août 2028');await expect(athlete.locator('.calendar-week-head').filter({hasText:'S105'})).toContainText('Charge moyenne');await athlete.getByRole('button',{name:'Aujourd’hui'}).click();
 for(const [p,time] of [[athlete,'24'],[coach,'28'],[admin,'30']]){
  await nav(p,'chronos');await p.getByRole('textbox',{name:'Chrono 200 mètres',exact:true}).fill(time);await p.getByRole('button',{name:'Enregistrer mes chronos'}).click();await p.locator('#target-distance').fill('200');await expect(p.locator('#results')).toContainText(`${Number(time)/.8}`.replace('.',','));
 }
 await nav(athlete,'chronos');await expect(athlete.getByRole('textbox',{name:'Chrono 200 mètres',exact:true})).toHaveValue('24');
 await nav(coach,'entrainements');await coach.getByRole('button',{name:'+ Séance',exact:true}).click();
 const editor=coach.locator('#editor');await editor.locator('[name=title]').fill('Musculation du matin');await editor.locator('[name=date]').fill('2026-10-02');await editor.locator('[name=slot]').selectOption('matin');await editor.locator('[name=type]').selectOption('strength');await editor.locator('[name=load]').selectOption('high');await editor.locator('[name=warmup]').fill('Mobilité');await editor.locator('[name=workout]').fill('Travail de force');await editor.getByRole('button',{name:'+ Ajouter une cible'}).click();await editor.locator('.target-distance').fill('250');await editor.getByRole('button',{name:'+ Ajouter une cible'}).click();await editor.locator('.target-row').last().locator('.target-distance').fill('400');await editor.locator('.target-row').last().locator('.target-kind').selectOption('range');await editor.locator('.target-row').last().locator('.target-label').fill('Filles');await editor.locator('.target-row').last().locator('.target-min').fill('1:30');await editor.locator('.target-row').last().locator('.target-max').fill('1:35');await editor.getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(editor).not.toBeVisible();
 await coach.getByRole('button',{name:'+ Séance',exact:true}).click();await editor.locator('[name=title]').fill('Technique après-midi');await editor.locator('[name=slot]').selectOption('apres-midi');await editor.locator('[name=workout]').fill('Gammes et accélérations');await editor.locator('[name=v2]').fill('Consigne alternative');await editor.getByRole('button',{name:'Enregistrer pour l’équipe'}).click();
 await expect(coach.locator('#daily-sessions .session-card')).toHaveCount(2);await expect(coach.locator('.calendar-day[data-date="2026-10-02"] .event-label')).toHaveCount(2);
 await athlete.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await nav(athlete,'entrainements');await athlete.getByRole('button',{name:'Mois suivant'}).click();await athlete.locator('.calendar-day[data-date="2026-10-02"]').click();
 await expect(athlete.locator('#daily-sessions')).toContainText('Musculation du matin',{timeout:20000});await expect(athlete.locator('#daily-sessions .session-card')).toHaveCount(2);await expect(athlete.locator('#daily-sessions .session-target').first()).toContainText('estimation');await expect(athlete.locator('#daily-sessions .session-target').first()).toContainText('m/s');await expect(athlete.locator('#daily-sessions')).toContainText('1:30 – 1:35');await expect(athlete.locator('#daily-sessions')).toContainText('Équiv. pour vous');await expect(athlete.locator('#daily-sessions')).toContainText('Charge séance : élevée');
 await coach.locator('#daily-sessions .session-card').filter({hasText:'Musculation du matin'}).getByRole('button',{name:'Modifier / déplacer'}).click();await editor.locator('[name=date]').fill('2026-10-04');await editor.getByRole('button',{name:'Enregistrer pour l’équipe'}).click();
 await expect(coach.locator('.calendar-day[data-date="2026-10-02"] .event-label')).toHaveCount(1);await expect(coach.locator('.calendar-day[data-date="2026-10-04"] .event-label')).toHaveCount(1);
 await nav(coach,'bibliotheque');await coach.getByRole('button',{name:'+ Ajouter'}).click();await editor.locator('[name=title]').fill('Test acronyme');await editor.locator('[name=body]').fill('<script>alert(1)</script> : texte simple');await editor.getByRole('button',{name:'Enregistrer pour l’équipe'}).click();await expect(coach.locator('#library-content')).toContainText('<script>alert(1)</script>');
 await nav(coach,'infos');await expect(coach.locator('.info-card')).toHaveCount(12);await coach.locator('.info-card').first().getByRole('button',{name:'Modifier',exact:true}).click();await editor.locator('[name=title]').fill('Les stages — information actualisée');await editor.getByRole('button',{name:'Enregistrer pour l’équipe'}).click();
 await athlete.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await nav(athlete,'infos');await expect(athlete.locator('.info-card').first()).toContainText('Les stages — information actualisée',{timeout:20000});
 await nav(admin,'groupe');await admin.locator('#member-search').fill('Camille');await expect(admin.locator('#member-rows')).toContainText('0600000000');
 await nav(admin,'reglages');admin.on('dialog',dialog=>dialog.accept());
 const memberRow=admin.locator('tr').filter({hasText:'Camille Martin'});await memberRow.getByRole('button',{name:'Nommer admin'}).click();await expect(admin.locator('tr').filter({hasText:'Camille Martin'})).toContainText('Retirer les droits admin');
 await admin.locator('tr').filter({hasText:'Camille Martin'}).getByRole('button',{name:'Retirer les droits admin'}).click();await expect(admin.locator('tr').filter({hasText:'Camille Martin'})).toContainText('Nommer admin');
 await expect(admin.locator('tr').filter({hasText:'Maylis Chancerelle'}).getByRole('button',{name:'Retirer les droits admin'})).toBeDisabled();
 await nav(coach,'entrainements');await coach.locator('.calendar-day[data-date="2026-10-01"]').click();await coach.screenshot({path:join(import.meta.dirname,'test-results/coach-desktop.png'),fullPage:true});
 await athlete.setViewportSize({width:390,height:844});await athlete.getByRole('button',{name:'☰ Menu'}).click();await nav(athlete,'entrainements');
 await expect(athlete.locator('#navigation')).not.toBeVisible();assert.equal(await athlete.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Pas de défilement horizontal sur mobile');
 await athlete.screenshot({path:join(import.meta.dirname,'test-results/athlete-mobile.png'),fullPage:true});
 await athlete.reload();await expect(athlete.getByRole('button',{name:'Se connecter',exact:true})).toBeVisible();await expect(athlete.locator('#navigation')).toBeHidden();
 await athlete.locator('[name=email]').fill('camille');await athlete.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(athlete.locator('#daily-sessions')).toBeVisible();
 await athlete.getByRole('button',{name:'☰ Menu'}).click();await nav(athlete,'reglages');await athlete.locator('#settings-form [name=email]').fill('coach-test');await athlete.getByRole('button',{name:'Enregistrer mes réglages'}).click();await expect(athlete.locator('#settings-error')).toContainText('déjà utilisé');
 await athlete.locator('#settings-form [name=email]').fill('camille-nouvelle');await athlete.getByRole('button',{name:'Enregistrer mes réglages'}).click();await expect(athlete.locator('#settings-form [name=email]')).toHaveValue('camille-nouvelle');
 await athlete.getByRole('button',{name:'Supprimer mon profil',exact:true}).click();
 await athlete.locator('#editor [name=identifier]').fill('camille-nouvelle');await athlete.locator('#editor [name=confirm]').check();await athlete.getByRole('button',{name:'Supprimer définitivement mon profil',exact:true}).click();await expect(athlete.getByRole('button',{name:'Se connecter',exact:true})).toBeVisible();
 await expect(admin.getByRole('button',{name:'Supprimer mon profil',exact:true})).toBeDisabled();
 await expect(coach.getByRole('button',{name:'+ Séance',exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);console.log('Parcours navigateur OK : admin/coach/athlète dans des onglets indépendants, chronos, séances multiples, déplacement, contenus, synchronisation, annuaire, transmission admin, connexion obligatoire et mobile.');
} finally {
 await browser?.close();if(server.exitCode===null){const exit=once(server,'exit');server.kill('SIGTERM');await exit;}
}
