import { distances, types, parseTime, trainingTarget, equivalentIntensity, sessionLoad, formatTime, formatSpeed, dateKey, fromKey } from './core.mjs';
import { seasonStart, seasonWeekCount, seasonWeekDate, seasonWeekForDate, defaultSeason } from './season.mjs';
import { difficultyLabels, competitionLevels, mondayOf, addDays, isoWeekValue, dateFromWeek, publicDifficulty } from './community-core.mjs';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots = {'non-precise':'Créneau à préciser',matin:'Matin','apres-midi':'Après-midi',soir:'Soir'};
const compactTypes={speed:'Vitesse',strength:'Muscu',vo2:'VO₂',endurance:'Endu.',hills:'Côtes',competition:'Compét.',group:'Groupe',rest:'Repos'};
const compactSlots={matin:'Matin','apres-midi':'Après-m.',soir:'Soir'};
const loadLabels={light:'légère',medium:'moyenne',high:'élevée'};
const loadOptions={auto:'Selon la semaine de l’Excel',light:'Légère',medium:'Moyenne',high:'Élevée',none:'Ne pas afficher de charge'};
const seasonKinds={generalPeriods:'Période de saison',trainingPeriods:'Cycle / période d’entraînement',intensityPeriods:'Intensité et volume',schoolHolidays:'Vacances scolaires',absences:'Absence / indisponibilité',stages:'Stage',seasonNotes:'Note de saison'};
const coachTime=value=>formatTime(value).replace(/,00(?= s|$)/,'');
const percentText=value=>`${Number(value.toFixed(1)).toLocaleString('fr-FR',{maximumFractionDigits:1})} %`;
const loadBadge=s=>{const load=sessionLoad(s,state?.season);return load?`<span class="pill load-pill load-${load.level}" title="${load.source==='week'?'Charge prévue dans le planning hebdomadaire':'Charge indiquée pour cette séance'}">Charge ${load.source==='week'?'semaine':'séance'} : ${loadLabels[load.level]}</span>`:'';};
const loadMarker=s=>{const load=sessionLoad(s,state?.season);return load?`<span class="load-mark load-${load.level}" aria-hidden="true">${'▮'.repeat({light:1,medium:2,high:3}[load.level])}</span>`:'';};
const fullDate = key => fromKey(key).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const shortDate = key => fromKey(key).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const today = () => dateKey(new Date());
let selectedDate=today(),month=fromKey(selectedDate); month.setDate(1);
let user=null,accessToken=null,csrf=null,setup=false,pendingAccount=null,state=null,pollBusy=false,editSubmit=null,toastTimer,pendingRender=false;
const coachSignupHint = new URLSearchParams(location.search).has('invitation');
if(coachSignupHint)history.replaceState(null,'',location.pathname+'#inscription');
const coach = () => user?.role==='coach';
const admin = () => user?.role==='admin';
const roleLabel = role => ({admin:'Admin',coach:'Coach',athlete:'Athlète'})[role];
const page = () => location.hash.slice(1) || 'entrainements';
const options = (values,selected) => Object.entries(values).map(([v,t])=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(t)}</option>`).join('');
function toast(message) {$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(path,method='GET',body) {
 const headers={};if(accessToken)headers.Authorization=`Bearer ${accessToken}`;
 if(method!=='GET'){headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;}
 const response=await fetch('/api'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error||'Requête impossible.'),{status:response.status});return value;
}
function header() {
 $('#navigation').hidden=!user;
 $('#account').innerHTML=user?`<button class="secondary mobile-menu" data-action="menu" aria-controls="navigation" aria-expanded="false">☰ Menu</button><span class="account-name">${esc(user.name)} · ${roleLabel(user.role)}</span><a class="profile-link" href="#chronos">Mes chronos ↗</a><button class="text-button" data-action="logout">Déconnexion</button>`:'';
 document.querySelectorAll('.navigation a').forEach(a=>{if(a.hash==='#'+page())a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
function authPage() {
 header(); const register=page()==='inscription',initial=setup&&page()==='initialisation';
 $('#main').innerHTML=`<section class="card auth-card"><p class="eyebrow">L’ESPACE PRIVÉ DU GROUPE</p><h1>${initial?'Bienvenue, Maylis.':register?'Rejoindre l’équipe.':'De retour sur la piste.'}</h1><p class="muted">${initial?'Votre profil admin est prêt. Choisissez vos identifiants de connexion.':register?'Créez votre compte pour rejoindre l’équipe.':'Saisissez votre identifiant et votre mot de passe.'}</p><form id="auth-form">
 ${(register||initial)?`<div class="form-grid"><label>Prénom<input name="name" value="${initial?esc(pendingAccount?.name):''}" autocomplete="given-name" maxlength="80" required></label><label>Nom<input name="lastName" value="${initial?esc(pendingAccount?.lastName):''}" autocomplete="family-name" maxlength="80"></label></div><label>Téléphone (facultatif)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><p class="help">Votre nom, prénom et téléphone seront visibles dans l’annuaire privé du groupe.</p>`:''}
 <label>Identifiant<input name="email" value="${initial?esc(pendingAccount?.email):''}" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="180" required><small>Les majuscules et les minuscules comptent.</small></label>
 <label>Mot de passe<input name="password" type="password" autocomplete="${register||initial?'new-password':'current-password'}" maxlength="1024" required></label>
 ${register?'<label>Code du groupe<input name="groupCode" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" required><small>Le code respecte les majuscules et les minuscules.</small></label>':''}
 ${!register&&!initial?'<p class="help">Déjà inscrit avant l’ajout des mots de passe ? Votre mot de passe provisoire est votre identifiant actuel. Vous pouvez le changer dans les réglages.</p>':''}
 ${register?`<label class="checkbox"><input type="checkbox" name="coach" ${coachSignupHint?'checked':''}> Je suis coach</label><p class="help">Cochez cette case si vous êtes coach et devez modifier les séances pour le groupe.</p><label id="signup-coach-code-label" ${coachSignupHint?'':'hidden'}>Code coach<input name="coachCode" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" ${coachSignupHint?'required':''}><small>Le code respecte les majuscules et les minuscules.</small></label>`:''}
 <p id="auth-error" role="alert" class="error"></p><button type="submit">${initial?'Activer mon compte admin':register?'Créer mon compte':'Se connecter'}</button></form><p class="help">${register||initial?'<a href="#connexion">Déjà membre ? Connexion</a>':'Nouveau membre ? <a href="#inscription">Inscription</a>'}</p>${setup&&!initial?'<p class="help"><a href="#initialisation">Maylis : activer mon compte admin</a></p>':''}</section>`;
 $('#auth-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,fields=new FormData(form),button=form.querySelector('button[type=submit]');button.disabled=true;$('#auth-error').textContent='';
  try {
   const result=await api(initial?'/setup':register?'/register':'/login','POST',{name:fields.get('name'),lastName:fields.get('lastName'),phone:fields.get('phone'),email:fields.get('email'),password:fields.get('password'),coach:fields.get('coach')==='on',groupCode:fields.get('groupCode'),coachCode:fields.get('coachCode')});
   user=result.user;csrf=result.csrf;accessToken=result.accessToken;setup=false;state=await api('/state');history.replaceState(null,'',location.pathname+'#entrainements');render();
 } catch(e){$('#auth-error').textContent=e.message;}finally{button.disabled=false;}
 };
 if(register){
  const coachBox=$('#auth-form [name=coach]'),coachLabel=$('#signup-coach-code-label'),coachCode=$('#auth-form [name=coachCode]');
  coachBox.onchange=()=>{coachLabel.hidden=!coachBox.checked;coachCode.required=coachBox.checked;if(!coachBox.checked)coachCode.value='';};
 }
}
function daySessions(key) {
 const items=state.sessions.filter(s=>s.date===key), active=items.filter(s=>s.type!=='rest');
 return (active.length?active:items).sort((a,b)=>['matin','apres-midi','soir','non-precise'].indexOf(a.slot||'non-precise')-['matin','apres-midi','soir','non-precise'].indexOf(b.slot||'non-precise'));
}
function selectDate(key) {selectedDate=key;month=fromKey(key);month.setDate(1);render();window.scrollTo({top:0,behavior:'smooth'});}
function weekStrip() {
 const monday=fromKey(selectedDate);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);
 return `<div class="week-navigation"><button class="icon-button" data-action="prev-week" aria-label="Semaine précédente" title="Semaine précédente">←</button><span>Semaine du ${esc(shortDate(dateKey(monday)))} au ${esc(shortDate(dateKey(sunday)))}</span><button class="icon-button" data-action="next-week" aria-label="Semaine suivante" title="Semaine suivante">→</button></div><div class="week-strip">${Array.from({length:7},(_,i)=>{const dt=new Date(monday);dt.setDate(dt.getDate()+i);const key=dateKey(dt),items=daySessions(key);return `<button class="week-day ${key===selectedDate?'selected':''} ${key===today()?'today':''}" data-date="${key}" aria-label="${esc(fullDate(key))}" aria-pressed="${key===selectedDate}"><span>${dt.toLocaleDateString('fr-FR',{weekday:'short'})}</span><strong>${dt.getDate()}</strong><div class="dots">${[...new Set(items.map(s=>s.type))].map(t=>`<i class="dot type-${t}"></i>`).join('')}</div></button>`;}).join('')}</div>`;
}
function targetCard(t) {
 const name=t.label?`<span class="target-group">${esc(t.label)}</span>`:'';
 if(t.kind==='range'){
  const intensity=equivalentIntensity(state.profile.times,t.distance,t.minTime,t.maxTime);
  const range=t.minTime===t.maxTime?coachTime(t.minTime):`${coachTime(t.minTime)} – ${coachTime(t.maxTime)}`;
  const equivalent=intensity?`Équiv. pour vous : ${percentText(intensity.min)}${Math.abs(intensity.max-intensity.min)>0.05?' – '+percentText(intensity.max):''} de votre vitesse de référence`:'Ajoutez un chrono pour voir votre intensité équivalente';
  return `<div class="session-target">${name}${esc(t.distance)} m · plage coach<strong>${esc(range)}</strong><span class="target-meta">${equivalent}</span></div>`;
 }
 const target=trainingTarget(state.profile.times,t.distance,t.percent);
 return `<div class="session-target">${name}${esc(t.distance)} m à ${esc(t.percent)} %<strong>${target?formatTime(target.targetTime):t.distance<50||t.distance>1500?'Estimation indisponible':`<a href="#chronos">Ajouter un chrono de référence</a>`}</strong>${target?`<span class="target-meta">${formatSpeed(target.targetSpeed)} · ${target.kind==='mesuré'?'chrono saisi':'estimation'}</span>`:''}</div>`;
}
function sessionCard(s) {
 const targets=s.targets||[];
 return `<article class="card session-card type-${esc(s.type)}"><div class="section-head"><div class="session-badges"><span class="pill type-badge">${esc(types[s.type])}</span> <span class="pill">${esc(slots[s.slot||'non-precise'])}</span> ${loadBadge(s)}</div>${coach()?`<button class="secondary" data-edit="sessions" data-id="${esc(s.id)}">Modifier / déplacer</button>`:''}</div><p class="eyebrow">${esc(s.cycle||'ENTRAÎNEMENT')}</p><h2>${esc(s.title)}</h2>
 ${s.type==='rest'?`<p class="prose muted">${esc(s.workout)}</p>`:`<div class="session-parts"><section class="session-part"><h3 class="part-label"><span>01</span> Échauffement</h3><p class="prose ${!s.warmup?'muted':''}">${esc(s.warmup||'Non renseigné par le coach.')}</p></section><section class="session-part"><h3 class="part-label"><span>02</span> Séance</h3><p class="prose">${esc(s.workout||'Le détail de la séance sera précisé par le coach.')}</p>${s.v2?`<aside class="variant"><h3>Version 2</h3><p class="prose">${esc(s.v2)}</p></aside>`:''}</section></div>`}
 ${targets.length?`<div class="session-targets">${targets.map(targetCard).join('')}</div>`:''}
 ${coach()&&s.coachNote?`<p class="coach-note"><strong>Note coach</strong><br>${esc(s.coachNote)}</p>`:''}${sessionFeedback(s.id)}</article>`;
}
function sessionFeedback(id) {
 const comments=(state.comments||[]).filter(c=>c.sessionId===id),summary=publicDifficulty(comments),mine=comments.some(c=>c.userId===user.id);
 return `<div class="session-feedback">${summary.count?`<div class="difficulty-summary"><span>Difficulté ressentie <strong>${summary.average.toLocaleString('fr-FR',{maximumFractionDigits:1})} / 5</strong></span><meter min="0" max="5" value="${summary.average}" aria-label="Difficulté moyenne des avis publics : ${summary.average.toFixed(1)} sur 5"></meter><small>${summary.count} avis public${summary.count>1?'s':''} · 1 = très facile, 5 = très difficile</small></div>`:''}<button class="secondary" data-comments="${esc(id)}">${mine?'Mon commentaire':'Commenter'}${comments.length?` · ${comments.length} retour${comments.length>1?'s':''}`:''}</button></div>`;
}
function timelineBounds() {
 const dates=[seasonStart,seasonWeekDate(seasonWeekCount),...(state.competitions||[]).map(c=>c.weekStart)].sort();
 return {start:dates[0],count:Math.round((Date.parse(dates.at(-1))-Date.parse(dates[0]))/(7*86400000))+1};
}
function seasonNumber(key) {return Math.round((Date.parse(key)-Date.parse(seasonStart))/(7*86400000))+1;}
function competitionsForWeek(key) {return (state.competitions||[]).filter(c=>c.weekStart===mondayOf(key));}
const competitionTiming=c=>c.date?fullDate(c.date):`Semaine du ${shortDate(c.weekStart)} au ${shortDate(addDays(c.weekStart,6))} ${fromKey(addDays(c.weekStart,6)).getFullYear()}`;
function timelineBands(label,items,kind,category) {
 const offset=seasonNumber(timelineBounds().start)-1;
 return `<div class="timeline-row"><span class="timeline-label">${label}</span>${items.map((item,index)=>{const type=item.category||category,at=item.index??index,tag=coach()?'button':'span';return `<${tag} ${coach()?`type="button" data-season-category="${type}" data-season-index="${at}"`:''} data-grid-start="${item.start+1-offset}" data-grid-span="${item.end-item.start+1}" class="timeline-band timeline-${kind} ${item.tone?`tone-${item.tone}`:''} ${coach()?'season-editable':''}" title="${coach()?'Modifier · ':''}S${item.start}${item.end!==item.start?' à S'+item.end:''} · ${esc(item.label)}">${esc(item.label)}</${tag}>`;}).join('')}</div>`;
}
function seasonTimeline() {
 const season=state.season||defaultSeason;
 const bounds=timelineBounds(),weeks=Array.from({length:bounds.count},(_,i)=>addDays(bounds.start,i*7));
 const monthStart=dateKey(new Date(month.getFullYear(),month.getMonth(),1));
 const monthEnd=dateKey(new Date(month.getFullYear(),month.getMonth()+1,0));
 const inSeason=monthEnd>=bounds.start&&monthStart<=addDays(bounds.start,bounds.count*7-1);
 const weekCells=weeks.map(key=>{
  const number=seasonNumber(key),end=fromKey(key);end.setDate(end.getDate()+6);
  const monthActive=key<=monthEnd&&dateKey(end)>=monthStart;
  const label=number>=1&&number<=seasonWeekCount?`S${number}`:isoWeekValue(key);
  return `<button class="timeline-week ${monthActive?'in-month':''} ${mondayOf(selectedDate)===key?'selected':''}" data-date="${key}" data-week="${number}" title="${label} · ${esc(fullDate(key))} – ${esc(shortDate(dateKey(end)))}">${label}<small>${esc(shortDate(key))}</small></button>`;
 }).join('');
 const loadCells=weeks.map(key=>{
  const i=seasonNumber(key)-1,level=season.weeklyLoads[i]||null;
  if(!level&&(!coach()||i<0||i>=seasonWeekCount))return '<span class="timeline-empty"></span>';
  const tag=coach()?'button':'span';
  return `<${tag} ${coach()?`type="button" data-season-week="${i+1}"`:''} class="timeline-load ${level?`load-${level}`:'load-empty'} ${coach()?'season-editable':''}" title="S${i+1} · ${level?'charge '+loadLabels[level]:'charge à renseigner'}${coach()?' · modifier':''}">${level?`<span>${'▮'.repeat({light:1,medium:2,high:3}[level])}</span><small>${loadLabels[level]}</small>`:'+'}</${tag}>`;
 }).join('');
 const stageItems=[...season.stages.map((item,index)=>({...item,category:'stages',index})),...season.seasonNotes.map((item,index)=>({...item,category:'seasonNotes',index}))].sort((a,b)=>a.start-b.start);
 const competitionCells=weeks.map(key=>{
  const items=competitionsForWeek(key);
  return `<div class="timeline-competition-cell">${items.map(item=>`<button type="button" data-competition="${esc(item.id)}" class="timeline-competition season-editable" title="${esc(competitionTiming(item))} · ${esc(item.title)}">${esc(item.title)}</button>`).join('')}</div>`;
 }).join('');
 return `<details class="card season-overview" ${inSeason?'open':''}><summary><strong>La planification en un coup d’œil</strong></summary><div class="season-tools">${coach()?'<button class="secondary" data-action="new-season-band">+ Ajouter un repère</button>':''}<button class="secondary" data-action="new-competition">+ Compétition</button></div><div class="season-rail" id="season-rail" role="region" aria-label="Frise des semaines de la saison" tabindex="0"><div class="season-rail-inner"><div class="timeline-row timeline-weeks"><span class="timeline-label">Semaines</span>${weekCells}</div>${timelineBands('Période saison',season.generalPeriods,'general','generalPeriods')}${timelineBands('Cycle',season.trainingPeriods,'training','trainingPeriods')}${timelineBands('Intensité / volume',season.intensityPeriods,'intensity','intensityPeriods')}<div class="timeline-row"><span class="timeline-label">Charge</span>${loadCells}</div>${timelineBands('Vacances IDF',season.schoolHolidays,'holiday','schoolHolidays')}${timelineBands('Absences',season.absences||[],'absence','absences')}${timelineBands('Stages / notes',stageItems,'stage')}<div class="timeline-row"><span class="timeline-label">Compétitions</span>${competitionCells}</div></div></div></details>`;
}
function calendarDay(key) {
 const dt=fromKey(key),items=daySessions(key),outside=dt.getMonth()!==month.getMonth()||dt.getFullYear()!==month.getFullYear();
 const competitions=(state.competitions||[]).filter(c=>c.date===key&&!items.some(s=>s.id===c.sourceSessionId));
 const label=[...items.map(s=>{const load=sessionLoad(s,state.season);return s.title+(load?` (charge ${load.source==='week'?'de la semaine':'de la séance'} ${loadLabels[load.level]})`:'');}),...competitions.map(c=>c.title)].join(', ')||'Aucune séance renseignée';
 return `<button class="calendar-day ${outside?'outside-month':''} ${key===selectedDate?'selected':''} ${key===today()?'today':''}" data-date="${key}" aria-label="${esc(fullDate(key))} : ${esc(label)}" aria-pressed="${key===selectedDate}"><strong>${dt.getDate()}</strong>${items.map(s=>`<span class="event-label type-${s.type}"><span class="event-full">${s.slot&&s.slot!=='non-precise'?esc(slots[s.slot])+' · ':''}${esc(types[s.type])}</span><span class="event-short">${compactSlots[s.slot]?`<small>${esc(compactSlots[s.slot])}</small>`:''}${esc(compactTypes[s.type])}</span>${loadMarker(s)}</span>`).join('')}${competitions.map(c=>`<span class="event-label type-competition" title="${esc(c.title)}"><span class="event-full">${esc(c.title)}</span><span class="event-short">Compét.</span></span>`).join('')}</button>`;
}
function calendarWeek(start) {
 const key=dateKey(start),context=seasonWeekForDate(key,state.season);
 const days=Array.from({length:7},(_,i)=>{const dt=new Date(start);dt.setDate(dt.getDate()+i);return dateKey(dt);});
 const load=context?.load?`<span class="week-context-load load-${context.load}">Charge ${loadLabels[context.load]} <span aria-hidden="true">${'▮'.repeat({light:1,medium:2,high:3}[context.load])}</span></span>`:'';
 const competitionLabels=competitionsForWeek(key).map(c=>`<button class="week-context-competition" data-competition="${esc(c.id)}" title="${esc(competitionTiming(c))}">${esc(c.title)}</button>`).join('');
 const ribbons=[context?.holiday?`<span class="week-ribbon week-holiday">${esc(context.holiday.label)}</span>`:'',context?.absence?`<span class="week-ribbon week-absence">${esc(context.absence.label)}</span>`:'',context?.stage?`<span class="week-ribbon week-stage">${esc(context.stage.label)}</span>`:''].filter(Boolean).join('');
 return `<div class="calendar-week"><div class="calendar-week-head"><strong>${context?`S${context.number}`:esc(shortDate(key))}</strong>${load}${context?.intensity?`<span class="week-context-intensity">${esc(context.intensity.label)}</span>`:''}${competitionLabels}${context?.note?`<span class="week-context-note">${esc(context.note.label)}</span>`:''}</div>${ribbons?`<div class="calendar-week-ribbons">${ribbons}</div>`:''}<div class="calendar-week-days">${days.map(calendarDay).join('')}</div></div>`;
}
function calendar() {
 const first=new Date(month.getFullYear(),month.getMonth(),1),last=new Date(month.getFullYear(),month.getMonth()+1,0),monday=new Date(first);
 monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 const weeks=[];
 while(monday<=last){weeks.push(calendarWeek(new Date(monday)));monday.setDate(monday.getDate()+7);}
 return `<section class="card month-calendar"><div class="section-head"><div><p class="eyebrow">LE CALENDRIER DE L’ÉQUIPE</p><h2>${esc(month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}))}</h2></div><div class="actions"><button class="icon-button" data-action="prev-month" aria-label="Mois précédent">←</button><button class="icon-button" data-action="next-month" aria-label="Mois suivant">→</button></div></div><div class="legend">${Object.entries(types).map(([k,v])=>`<span><i class="dot type-${k}"></i>${esc(v)}</span>`).join('')}<span class="load-legend">▮ / ▮▮ / ▮▮▮ : charge légère / moyenne / élevée</span></div><div class="weekdays">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-weeks">${weeks.join('')}</div><p class="footer-note">Cliquez sur un jour pour consulter ${coach()?'ou ajouter ':''}ses séances. Les périodes et événements de l’Excel sont consultables dans la frise ci-dessous.</p></section>`;
}
function trainingPage() {
 const items=daySessions(selectedDate);
 const dailyCompetitions=(state.competitions||[]).filter(c=>c.date===selectedDate);
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">${esc(fullDate(selectedDate))}</p><h1>${selectedDate===today()?'Aujourd’hui, sur la piste.':'Votre journée d’entraînement.'}</h1><p class="muted">${items.filter(s=>s.type!=='rest').length} séance(s) · ${esc(user.name)}</p></div><div class="actions"><button class="secondary" data-action="today">Aujourd’hui</button>${coach()?'<button data-action="new-session">+ Séance</button>':''}</div></div>${weekStrip()}${dailyCompetitions.length?`<section class="card daily-competitions"><h2>Compétitions du jour</h2>${dailyCompetitions.map(c=>`<button class="secondary" data-competition="${esc(c.id)}">${esc(c.title)}${c.location?' · '+esc(c.location):''}</button>`).join('')}<a href="#competitions">Voir les inscriptions ↗</a></section>`:''}<div id="daily-sessions">${items.length?items.map(sessionCard).join(''):'<section class="card empty-state"><h2>Aucune séance renseignée</h2><p>Le planning de cette journée n’a pas encore été renseigné.</p></section>'}</div>${calendar()}${seasonTimeline()}`;
 const bounds=timelineBounds();
 document.querySelectorAll('.timeline-row').forEach(row=>{row.style.gridTemplateColumns=`var(--timeline-label-width) repeat(${bounds.count},var(--timeline-cell-width))`;});
 document.querySelectorAll('[data-grid-start]').forEach(band=>{band.style.gridColumn=`${band.dataset.gridStart} / span ${band.dataset.gridSpan}`;});
 const rail=$('#season-rail'),number=seasonNumber(mondayOf(dateKey(new Date(month.getFullYear(),month.getMonth(),15))));
 if(rail&&number){const target=rail.querySelector(`[data-week="${number}"]`);if(target)rail.scrollLeft=Math.max(0,target.offsetLeft-rail.clientWidth/2+target.clientWidth/2);}
}
function chronoPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">MON ESPACE PERSONNEL</p><h1>Mes chronos, mes allures.</h1><p class="muted">Ces références appartiennent uniquement à ${esc(user.name)}.</p></div><span class="pill">Privé</span></div>
 <section class="card"><div class="calculator-head"><div><p class="eyebrow">CALCULATEUR PERSONNEL</p><h2>Les temps à viser</h2><p class="help">Choisissez la distance de la séance, même si vous n’avez pas de chrono sur celle-ci.</p></div><div class="calculator-fields"><label>Distance à courir (m)<input id="target-distance" type="number" min="50" max="1500" step="1" value="250"></label><label>Intensité souhaitée (%)<input id="percent" type="number" min="0.1" max="150" step="0.1" value="80"></label></div></div><div class="actions"><button class="secondary" data-percent="80">80 %</button><button class="secondary" data-percent="85">85 %</button><button class="secondary" data-percent="89">89 %</button><button class="secondary" data-percent="90">90 %</button></div><p class="help formula">Le site estime d’abord votre chrono sur la distance choisie à partir de vos chronos connus. Il applique ensuite le pourcentage à la vitesse en m/s, comme dans le tableau du coach. Les chronos saisis restent des points exacts de la courbe.</p><div id="results" class="result-grid"></div></section>
 <section class="card"><div class="section-head"><h2>Mes temps de référence</h2></div><p class="help">Renseignez seulement les distances connues, en secondes (54,32) ou minutes:secondes (1:02,50). Une case vide signifie « chrono inconnu ».</p><form id="chrono-form" data-version="${state.profileVersion}"><div class="chrono-grid">${distances.map(d=>`<label>${d} m<input name="time-${d}" inputmode="decimal" placeholder="—" value="${esc(state.profile.times?.[d]?.toString().replace('.',',')||'')}" aria-label="Chrono ${d} mètres"></label>`).join('')}</div><p class="error" id="chrono-error" role="alert"></p><div class="form-actions"><button type="submit">Enregistrer mes chronos</button></div></form></section>`;
 $('#chrono-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,times={},button=form.querySelector('button');$('#chrono-error').textContent='';
  try {for(const d of distances){try{const time=parseTime(form.elements[`time-${d}`].value);if(time!==null)times[d]=time;}catch(e){throw new Error(`${d} m : ${e.message}`);}}
   button.disabled=true;await api('/profile','PUT',{times,version:Number(form.dataset.version)});state=await api('/state');form.dataset.version=state.profileVersion;calculate();toast('Vos chronos personnels sont enregistrés.');
  }catch(e){$('#chrono-error').textContent=e.message;}finally{button.disabled=false;}
 };
 $('#percent').oninput=calculate;$('#target-distance').oninput=calculate;calculate();
}
function calculate() {
 const percent=Number($('#percent').value),distance=Number($('#target-distance').value);
 if(!Number.isFinite(percent)||percent<=0||percent>150){$('#results').innerHTML='<p class="error">Saisissez un pourcentage entre 0 (exclu) et 150.</p>';return;}
 if(!Number.isInteger(distance)||distance<50||distance>1500){$('#results').innerHTML='<p class="error">Choisissez une distance entre 50 et 1 500 m.</p>';return;}
 const target=trainingTarget(state.profile.times,distance,percent);
 $('#results').innerHTML=target?`<div class="result-card result-card-primary"><small>${distance} m · ${percent} % de la vitesse de référence</small><strong>${formatTime(target.targetTime)}</strong><span class="result-speed">Allure cible : ${formatSpeed(target.targetSpeed)}</span><span class="reference">${target.kind==='mesuré'?'Chrono saisi':'Chrono estimé'} sur ${distance} m : ${formatTime(target.time)} · ${formatSpeed(target.referenceSpeed)}</span>${target.kind!=='mesuré'?`<span class="reference">Estimation à partir de ${target.anchors.map(d=>`${d} m`).join(' et ')}${target.kind==='extrapolé'?' — plus incertaine hors des distances connues':''}.</span>`:''}</div>`:'<p class="muted">Enregistrez au moins un chrono personnel pour afficher une estimation.</p>';
}
const editButtons=(collection,item)=>coach()?`<div class="actions"><button class="secondary" data-edit="${collection}" data-id="${esc(item.id)}">Modifier</button><button class="text-button" data-archive="${collection}" data-id="${esc(item.id)}">Archiver</button></div>`:'';
function libraryPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">LES REPÈRES DE L’ÉQUIPE</p><h1>Un langage commun.</h1><p class="muted">Les acronymes, gammes et circuits du coach.</p></div>${coach()?'<button data-action="new-library">+ Ajouter</button>':''}</div><label class="search">Rechercher un acronyme ou un circuit<input id="library-search" type="search" placeholder="SaS, Montsouris, gammes…"></label><div id="library-content"></div>`;
 const draw=()=>{
  const query=$('#library-search').value.toLocaleLowerCase('fr');
  $('#library-content').innerHTML=[['acronym','Les acronymes'],['circuit','Les circuits & gammes']].map(([category,label])=>{
   const items=state.library.filter(x=>x.category===category&&(x.title+' '+x.body).toLocaleLowerCase('fr').includes(query));
   return `<section class="group-section"><h2>${label}</h2><div class="library-grid">${items.map(item=>category==='acronym'?`<article class="card"><h3>${esc(item.title)}</h3><p class="prose">${esc(item.body)}</p>${editButtons('library',item)}</article>`:`<details><summary>${esc(item.title)}</summary><p class="prose">${esc(item.body)}</p>${editButtons('library',item)}</details>`).join('')}</div>${!items.length?'<p class="muted">Aucun résultat.</p>':''}</section>`;
  }).join('');
 };$('#library-search').oninput=draw;draw();
}
function infoPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">LA VIE DU GROUPE</p><h1>Ensemble, toute la saison.</h1><p class="muted">Le mot du coach : organisation, engagement et respect.</p></div>${coach()?'<button data-action="new-info">+ Information</button>':''}</div><section class="card welcome"><p class="eyebrow">NOTRE ESPRIT D’ÉQUIPE</p><h2>Encouragez-vous, prenez soin des autres.</h2><p>Les informations pratiques et les règles pour partager la piste dans les meilleures conditions.</p></section>${[['organisation','Organisation & pratique'],['relationnel','Relations & règles du groupe']].map(([category,title])=>`<section class="group-section"><h2>${title}</h2><div class="info-grid">${state.info.filter(item=>item.category===category).map(item=>`<article class="card info-card"><div class="info-icon" aria-hidden="true">${esc(item.icon)}</div><h3>${esc(item.title)}</h3><p class="prose">${esc(item.body)}</p>${editButtons('info',item)}</article>`).join('')}</div></section>`).join('')}`;
}
const joinedDate=m=>m.createdAt?new Date(m.createdAt).toLocaleDateString('fr-FR'):'Non renseignée';
function groupPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">L’ANNUAIRE PRIVÉ</p><h1>Les visages du groupe.</h1><p class="muted">${state.members.length} membre(s) · Coordonnées visibles uniquement après connexion.</p></div></div><section class="card"><label class="search">Rechercher un membre<input id="member-search" type="search" placeholder="Prénom ou nom…"></label><div class="table-scroll"><table><thead><tr><th>Prénom</th><th>Nom</th><th>Téléphone</th><th>Profil</th><th>Ajout du compte</th></tr></thead><tbody id="member-rows"></tbody></table></div></section>`;
 const draw=()=>{const query=$('#member-search').value.toLocaleLowerCase('fr');$('#member-rows').innerHTML=state.members.filter(m=>(m.name+' '+m.lastName).toLocaleLowerCase('fr').includes(query)).map(m=>`<tr><td><strong>${esc(m.name)}</strong>${m.id===user.id?' <small>(vous)</small>':''}</td><td>${esc(m.lastName)||'—'}</td><td>${esc(m.phone)||'<span class="muted">Non renseigné</span>'}</td><td><span class="pill">${roleLabel(m.role)}</span></td><td>${joinedDate(m)}</td></tr>`).join('');};$('#member-search').oninput=draw;draw();
}
function settingsPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">MON COMPTE</p><h1>Mes réglages.</h1><p class="muted">Votre identifiant, votre identité et vos coordonnées dans le groupe.</p></div></div><section class="card"><div class="section-head"><div><h2>${esc(user.name)} ${esc(user.lastName)}</h2><p>Identifiant : ${esc(user.email)}</p></div><span class="pill">Profil ${roleLabel(user.role).toLowerCase()}</span></div><p class="help">${admin()?'Vous gérez les droits d’administration. Les inscriptions utilisent un code de groupe et le rôle coach un code dédié. Vos chronos restent personnels.':coach()?'Vous pouvez modifier les entraînements, les circuits et les informations pour toute l’équipe. Vos chronos restent personnels.':'Vous pouvez consulter le planning du groupe et gérer vos chronos personnels. Le coach se charge du contenu partagé.'}</p><form id="settings-form" data-version="${user.accountVersion}"><div class="form-grid"><label class="full-width">Identifiant de connexion<input name="email" value="${esc(user.email)}" autocomplete="username" maxlength="180" required><small>Unique dans le groupe. Si vous le changez, utilisez le nouveau pour votre prochaine connexion.</small></label><label>Prénom<input name="name" value="${esc(user.name)}" autocomplete="given-name" maxlength="80" required></label><label>Nom<input name="lastName" value="${esc(user.lastName)}" autocomplete="family-name" maxlength="80"></label><label class="full-width">Téléphone<input name="phone" type="tel" value="${esc(user.phone)}" autocomplete="tel" maxlength="40"><small>Visible par les membres connectés dans « Le groupe ». Vous pouvez laisser ce champ vide.</small></label></div><p class="error" id="settings-error" role="alert"></p><div class="form-actions"><button type="submit">Enregistrer mes réglages</button></div></form></section>`;
 $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Mon mot de passe</h2><p class="help">${state.passwordProvisional?'Vous utilisez un mot de passe provisoire. Choisissez ici votre mot de passe personnel.':'Les majuscules et les minuscules comptent. Votre mot de passe reste le même lorsque vous changez votre identifiant.'}</p><form id="password-form" data-version="${state.passwordVersion}"><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" maxlength="1024" required></label><p id="password-error" class="error" role="alert"></p><div class="form-actions"><button type="submit">Changer mon mot de passe</button></div></form></section>`);
 $('#password-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;$('#password-error').textContent='';
 try{await api('/password','PUT',{password:form.elements.password.value,version:Number(form.dataset.version)});state=await api('/state');render();toast('Votre mot de passe a été changé.');}catch(e){$('#password-error').textContent=e.message;}finally{button.disabled=false;}
 };
 if(user.role!=='admin'){
  const needsCode=user.role==='athlete';
  $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Rôle dans le groupe</h2><p class="help">Cochez « Je suis coach » pour demander les droits coach ; saisissez le code coach demandé. Décochez-la pour retirer ces droits.</p><form id="self-coach-form" data-version="${user.accountVersion}"><label class="checkbox"><input type="checkbox" name="coach" ${coach()?'checked':''}> Je suis coach</label>${needsCode?`<label id="self-coach-code-label" ${coach()?'':'hidden'}>Code coach<input name="coachCode" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" ${coach()?'':'disabled'}><small>Le code respecte les majuscules et les minuscules.</small></label>`:''}<p id="self-coach-error" role="alert" class="error"></p><div class="form-actions"><button type="submit">Enregistrer mon rôle</button></div></form></section>`);
  const form=$('#self-coach-form'),checkbox=form.elements.coach,codeLabel=$('#self-coach-code-label'),codeInput=form.elements.coachCode;
  if(needsCode)checkbox.onchange=()=>{codeLabel.hidden=!checkbox.checked;codeInput.disabled=!checkbox.checked;codeInput.required=checkbox.checked;if(!checkbox.checked)codeInput.value='';};
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;$('#self-coach-error').textContent='';try{await api('/account/coach','PUT',{coach:checkbox.checked,coachCode:codeInput?.value,version:Number(form.dataset.version)});state=await api('/state');user=state.user;render();toast(checkbox.checked?'Droits coach activés.':'Droits coach retirés.');}catch(e){$('#self-coach-error').textContent=e.message;}finally{button.disabled=false;}};
 }
 const identifier=$('#settings-form [name=email]');identifier.autocapitalize='none';identifier.spellcheck=false;
 const lastAdmin=admin()&&state.members.filter(m=>m.role==='admin').length===1;
 $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Supprimer mon profil</h2><p class="help">Cette action supprime définitivement votre compte, vos coordonnées et vos chronos. Les séances et informations du groupe restent disponibles pour l’équipe.</p>${lastAdmin?'<p class="help">Vous êtes le dernier admin : nommez un autre administrateur ci-dessous avant de supprimer votre profil.</p>':''}<button class="secondary danger-button" data-action="delete-account" ${lastAdmin?'disabled':''}>Supprimer mon profil</button></section>`);
 if(admin()){
  const count=state.members.filter(m=>m.role==='admin').length;
  $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Codes d’accès au groupe</h2><p class="help">Ces codes sont communs à tous les comptes admin et visibles ici en permanence. Les majuscules et les minuscules comptent. Changer un code invalide immédiatement l’ancien.</p><form id="access-codes-form" data-version="${state.accessCodes.version}"><div class="form-grid"><label>Code du groupe<input name="groupCode" value="${esc(state.accessCodes.groupCode)}" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" required></label><label>Code coach<input name="coachCode" value="${esc(state.accessCodes.coachCode)}" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="128" required></label></div><p id="access-codes-error" role="alert" class="error"></p><div class="form-actions"><button type="submit">Mettre à jour les codes</button></div></form></section>`);
  $('#access-codes-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');button.disabled=true;$('#access-codes-error').textContent='';try{await api('/access-codes','PUT',{groupCode:form.elements.groupCode.value,coachCode:form.elements.coachCode.value,version:Number(form.dataset.version)});state=await api('/state');user=state.user;render();toast('Les codes d’accès ont été mis à jour pour tous les admins.');}catch(e){$('#access-codes-error').textContent=e.message;}finally{button.disabled=false;}};
  $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Gestion des membres</h2><p class="help">Les admins gèrent les comptes et les rôles. Les coachs modifient les séances. Une réinitialisation déconnecte le membre et lui attribue le nouveau mot de passe que vous choisissez, en respectant les majuscules.</p><div class="table-scroll"><table class="member-management"><thead><tr><th>Membre</th><th>Identifiant</th><th>Ajout du compte</th><th>Profil</th><th>Droits</th><th>Compte</th></tr></thead><tbody>${state.members.map(m=>`<tr><td>${esc(m.name)} ${esc(m.lastName)}${m.id===user.id?' (vous)':''}</td><td>${esc(m.email)}</td><td>${joinedDate(m)}</td><td>${roleLabel(m.role)}</td><td><div class="member-actions"><button class="secondary" data-admin-action="${m.role==='admin'?'revoke-admin':'grant-admin'}" data-id="${esc(m.id)}" ${m.role==='admin'&&count===1?'disabled title="Le dernier admin ne peut pas être retiré"':''}>${m.role==='admin'?'Retirer les droits admin':'Nommer admin'}</button>${m.role!=='admin'?`<button class="secondary" data-member-action="coach" data-id="${esc(m.id)}">${m.role==='coach'?'Retirer les droits coach':'Nommer coach'}</button>`:''}</div></td><td>${m.id===user.id?'<span class="muted">Vos formulaires personnels ci-dessus</span>':`<div class="member-actions"><button class="secondary" data-member-action="password" data-id="${esc(m.id)}">Réinitialiser le mot de passe</button><button class="secondary danger-button" data-member-action="delete" data-id="${esc(m.id)}">Supprimer le compte</button></div>`}</td></tr>`).join('')}</tbody></table></div><p class="help">Il doit rester au moins un admin. Une suppression efface les données personnelles du membre, ses commentaires et ses inscriptions, mais conserve les séances et compétitions partagées. Les dates anciennes non enregistrées restent « Non renseignée ».</p></section>`);
 }
 $('#settings-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;$('#settings-error').textContent='';try{await api('/account','PUT',{...Object.fromEntries(new FormData(form)),version:Number(form.dataset.version)});state=await api('/state');user=state.user;render();toast('Vos réglages sont enregistrés.');}catch(e){$('#settings-error').textContent=e.message;}finally{button.disabled=false;}};
}
function render() {
 pendingRender=false;header();if(!user)return authPage();if(!state)return;
 if(page()==='chronos')chronoPage();else if(page()==='competitions')competitionsPage();else if(page()==='bibliotheque')libraryPage();else if(page()==='infos')infoPage();else if(page()==='groupe')groupPage();else if(page()==='reglages')settingsPage();else trainingPage();
}
function modal(title,html,onSubmit,submitText='Enregistrer pour l’équipe') {
 $('#editor-title').textContent=title;$('#editor-fields').innerHTML=html;$('#editor-error').textContent='';editSubmit=onSubmit;
 const button=$('#editor-form button[type=submit]');button.textContent=submitText;button.disabled=false;button.hidden=false;$('#cancel-editor').textContent='Annuler';$('#editor').showModal();
}
function editComments(id) {
 const session=state.sessions.find(s=>s.id===id);if(!session)return;
 const comments=(state.comments||[]).filter(c=>c.sessionId===id),mine=comments.find(c=>c.userId===user.id),summary=publicDifficulty(comments);
 modal('Commentaires de séance',`<p class="help">${esc(session.title)} · ${esc(fullDate(session.date))}</p><div class="comment-form"><h3>Mon retour</h3><fieldset class="rating-picker"><legend>Difficulté ressentie (facultatif)</legend><div class="rating-stars">${difficultyLabels.map((label,i)=>`<label title="${i+1} / 5 · ${label}"><input type="radio" name="rating" value="${i+1}" ${mine?.rating===i+1?'checked':''} aria-label="${i+1} ${i?'étoiles':'étoile'} — ${label}"><span aria-hidden="true">★</span></label>`).join('')}</div><p class="rating-caption" id="rating-caption"></p><button type="button" class="text-button" id="clear-rating">Retirer la note</button></fieldset><label>Commentaire (facultatif)<textarea name="commentBody" maxlength="4000" rows="3" placeholder="Votre ressenti, un point à signaler…">${esc(mine?.body||'')}</textarea></label><label class="checkbox"><input name="isPrivate" type="checkbox" ${mine?.isPrivate?'checked':''}> Réservé à moi et aux coachs</label><p class="help">Par défaut, votre texte et votre difficulté sont visibles par tout le groupe. Un retour privé n’entre pas dans la moyenne publique.</p>${mine?'<button type="button" class="text-button danger-button" id="delete-comment">Supprimer mon commentaire</button>':''}</div><section class="comment-list"><h3>Les retours ${comments.length?`(${comments.length})`:''}</h3>${summary.count?`<p class="help">Moyenne publique : ${summary.average.toLocaleString('fr-FR',{maximumFractionDigits:1})} / 5 · ${summary.count} avis</p>`:''}${comments.length?comments.map(c=>`<article class="comment-item"><div class="comment-heading"><strong>${esc(c.name)} ${esc(c.lastName)}${c.userId===user.id?' · vous':''}</strong>${c.isPrivate?'<span class="pill">Privé · auteur et coachs</span>':'<span class="pill">Public</span>'}</div>${c.rating?`<p class="comment-rating" aria-label="${c.rating} sur 5 · ${difficultyLabels[c.rating-1]}"><span aria-hidden="true">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</span> ${difficultyLabels[c.rating-1]}</p>`:''}${c.body?`<p class="prose">${esc(c.body)}</p>`:''}<small class="muted">${new Date(c.updated).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></article>`).join(''):'<p class="muted">Aucun retour pour le moment.</p>'}</section>`,async form=>{
  const rating=form.elements.rating.value?Number(form.elements.rating.value):null;
  await api('/sessions/'+encodeURIComponent(id)+'/comment','PUT',{rating,body:form.elements.commentBody.value,isPrivate:form.elements.isPrivate.checked,version:mine?.version||0});
 },'Enregistrer mon commentaire');
 const form=$('#editor-form');
 const updateStars=()=>{const rating=Number(form.elements.rating.value)||0;form.querySelectorAll('.rating-stars label').forEach((label,i)=>label.classList.toggle('filled',i<rating));$('#rating-caption').textContent=rating?`${rating} / 5 · ${difficultyLabels[rating-1]}`:'1 = très facile · 5 = très difficile';};
 form.querySelectorAll('[name=rating]').forEach(input=>input.onchange=updateStars);
 $('#clear-rating').onclick=()=>{form.querySelectorAll('[name=rating]').forEach(input=>input.checked=false);updateStars();};updateStars();
 if(mine)$('#delete-comment').onclick=async()=>{
  if(!confirm('Supprimer votre commentaire et sa note ?'))return;
  const button=$('#delete-comment');button.disabled=true;
  try{await api('/sessions/'+encodeURIComponent(id)+'/comment','DELETE',{version:mine.version});$('#editor').close();state=await api('/state');render();toast('Votre commentaire a été supprimé.');}catch(e){$('#editor-error').textContent=e.message;button.disabled=false;}
 };
}
function competitionsPage() {
 const items=[...(state.competitions||[])].sort((a,b)=>(a.date||a.weekStart).localeCompare(b.date||b.weekStart)||a.title.localeCompare(b.title,'fr'));
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">LES RENDEZ-VOUS DE L’ÉQUIPE</p><h1>Compétitions.</h1><p class="muted">Le calendrier partagé et les inscriptions du groupe.</p></div><button data-action="new-competition">+ Compétition</button></div><section class="card"><p class="help">Une semaine suffit si la date précise n’est pas encore connue. Chacun peut compléter les informations et cocher son inscription.</p>${items.length?`<div class="table-scroll"><table class="competition-table"><thead><tr><th>Compétition</th><th>Date / semaine</th><th>Lieu</th><th>Niveau</th><th>Inscription</th><th>Inscrits</th><th><span class="visually-hidden">Modifier</span></th></tr></thead><tbody>${items.map(c=>{const signups=(state.signups||[]).filter(s=>s.competitionId===c.id);return `<tr data-competition-row="${esc(c.id)}"><td><strong>${esc(c.title)}</strong></td><td>${esc(competitionTiming(c))}${!c.date?'<small class="muted">Jour à préciser</small>':''}</td><td>${esc(c.location)||'<span class="muted">À préciser</span>'}</td><td>${esc(competitionLevels[c.level||''])}</td><td><label class="signup-label"><input type="checkbox" data-signup="${esc(c.id)}" ${signups.some(s=>s.userId===user.id)?'checked':''} aria-label="Mon inscription à ${esc(c.title)}"><span>Inscription</span></label></td><td><button class="secondary" data-participants="${esc(c.id)}">Inscrits (${signups.length})</button></td><td><button class="text-button" data-competition="${esc(c.id)}">Modifier</button></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">Aucune compétition renseignée. Ajoutez le premier rendez-vous du groupe.</p>'}</section>`;
}
function editCompetition(id) {
 const c=id?state.competitions.find(item=>item.id===id):{title:'',date:null,weekStart:mondayOf(selectedDate),location:'',level:''};if(!c)return;
 modal(id?'Modifier la compétition':'Ajouter une compétition',`<label>Nom de la compétition<input name="title" value="${esc(c.title)}" maxlength="180" required></label><label>Précision de la date<select name="datePrecision"><option value="week" ${c.date?'':'selected'}>Semaine uniquement</option><option value="day" ${c.date?'selected':''}>Jour précis</option></select></label><label id="competition-week-field">Semaine<input name="weekValue" type="week" value="${isoWeekValue(c.weekStart)}" required><small id="competition-week-caption"></small></label><label id="competition-date-field">Date<input name="date" type="date" value="${c.date||selectedDate}" required></label><div class="form-grid"><label>Lieu (facultatif)<input name="location" value="${esc(c.location)}" maxlength="180" placeholder="Ville, stade…"></label><label>Niveau<select name="level">${options(competitionLevels,c.level||'')}</select></label></div><p class="help">Les informations et inscriptions sont partagées avec toute l’équipe. La frise affiche toujours la compétition dans sa semaine.</p>${id?'<button type="button" class="text-button danger-button" id="delete-competition">Supprimer cette compétition</button>':''}`,async form=>{
  const exact=form.elements.datePrecision.value==='day';
  await api('/competitions'+(id?'/'+encodeURIComponent(id):''),id?'PUT':'POST',{title:form.elements.title.value,date:exact?form.elements.date.value:null,weekStart:exact?mondayOf(form.elements.date.value):dateFromWeek(form.elements.weekValue.value),location:form.elements.location.value,level:form.elements.level.value,...(id?{version:c.version}:{})});
 });
 const form=$('#editor-form'),sync=()=>{const exact=form.elements.datePrecision.value==='day';$('#competition-week-field').hidden=exact;form.elements.weekValue.disabled=exact;$('#competition-date-field').hidden=!exact;form.elements.date.disabled=!exact;};
 const caption=()=>{try{const key=dateFromWeek(form.elements.weekValue.value);$('#competition-week-caption').textContent=`Du ${shortDate(key)} au ${shortDate(addDays(key,6))}`;}catch{$('#competition-week-caption').textContent='Choisissez une semaine.';}};
 form.elements.datePrecision.onchange=sync;form.elements.weekValue.oninput=caption;sync();caption();
 if(id)$('#delete-competition').onclick=async()=>{
  if(!confirm(`Supprimer « ${c.title} » du planning des compétitions pour tout le groupe ?`))return;
  const button=$('#delete-competition');button.disabled=true;
  try{await api('/competitions/'+encodeURIComponent(id),'DELETE',{version:c.version});$('#editor').close();state=await api('/state');render();toast('Compétition retirée du planning.');}catch(e){$('#editor-error').textContent=e.message;button.disabled=false;}
 };
}
function showParticipants(id) {
 const c=state.competitions.find(item=>item.id===id);if(!c)return;
 const people=(state.signups||[]).filter(s=>s.competitionId===id);
 modal('Les inscrits',`<p><strong>${esc(c.title)}</strong></p><p class="help">${esc(competitionTiming(c))}</p>${people.length?`<ul class="participant-list">${people.map(p=>`<li><span>${esc(p.name)} ${esc(p.lastName)}${p.userId===user.id?' · vous':''}</span><span class="pill">${roleLabel(p.role)}</span></li>`).join('')}</ul>`:'<p class="muted">Personne n’est encore inscrit.</p>'}`,()=>{});
 $('#editor-form button[type=submit]').hidden=true;$('#cancel-editor').textContent='Fermer';
}
function targetRow(value={distance:200,percent:80}) {
 const range=value.kind==='range';
 return `<div class="target-row"><div class="target-row-main"><label>Distance (m)<input type="number" class="target-distance" min="1" max="10000" step="1" value="${esc(value.distance)}" required></label><label>Type de cible<select class="target-kind"><option value="percent" ${range?'':'selected'}>Pourcentage</option><option value="range" ${range?'selected':''}>Plage de temps</option></select></label><label>Groupe (facultatif)<input class="target-label" maxlength="60" placeholder="Filles, garçons, tous…" value="${esc(value.label||'')}"></label><button type="button" class="secondary remove-target" aria-label="Retirer cette allure">×</button></div><div class="target-details-percent" ${range?'hidden':''}><label>Vitesse (%)<input type="number" class="target-percent" min="0.1" max="150" step="0.1" value="${esc(value.percent??80)}" ${range?'disabled':''} required></label></div><div class="target-details-range" ${range?'':'hidden'}><label>Temps le plus rapide<input class="target-min" inputmode="decimal" placeholder="1:30" value="${range?esc(coachTime(value.minTime)):''}" ${range?'':'disabled'} required></label><label>Temps le plus lent<input class="target-max" inputmode="decimal" placeholder="1:35" value="${range?esc(coachTime(value.maxTime)):''}" ${range?'':'disabled'} required></label></div></div>`;
}
function syncTargetRow(row) {
 const range=row.querySelector('.target-kind').value==='range';
 row.querySelector('.target-details-percent').hidden=range;
 row.querySelector('.target-details-range').hidden=!range;
 row.querySelector('.target-percent').disabled=range;
 row.querySelector('.target-min').disabled=!range;
 row.querySelector('.target-max').disabled=!range;
}
function editSession(id) {
 if(!coach())return;
 const item=id?state.sessions.find(s=>s.id===id):{date:selectedDate,slot:'non-precise',type:'speed',targets:[]};
 modal(id?'Modifier la séance':'Ajouter une séance',`<div class="form-grid"><label class="full-width">Titre<input name="title" value="${esc(item.title)}" maxlength="180" required></label><label>Date<input name="date" type="date" value="${item.date}" required></label><label>Créneau<select name="slot">${options(slots,item.slot||'non-precise')}</select></label><label>Type de séance<select name="type">${options(types,item.type)}</select></label><label>Cycle / période<input name="cycle" value="${esc(item.cycle)}"></label><label>Charge de cette séance<select name="load">${options(loadOptions,item.load||'auto')}</select><small>Par défaut : charge de la semaine dans l’Excel. Choisissez une valeur pour la remplacer.</small></label><label class="full-width">Échauffement<textarea name="warmup">${esc(item.warmup)}</textarea></label><label class="full-width">Séance<textarea name="workout" rows="6">${esc(item.workout)}</textarea></label><label class="full-width">Version 2 — facultative<textarea name="v2">${esc(item.v2)}</textarea><small>Visible automatiquement par les athlètes si renseignée.</small></label></div><div class="editor-section"><h3>Allures et temps cibles</h3><p class="help">Ajoutez des pourcentages personnalisés ou des plages fixes (par exemple « Filles : 1:30–1:35 »). Les deux peuvent coexister. Les plages restent celles du coach ; le site indique à chacun leur intensité équivalente selon ses chronos.</p><div id="target-rows">${(item.targets||[]).map(targetRow).join('')}</div><button type="button" class="secondary" id="add-target">+ Ajouter une cible</button></div><div class="editor-section"><label>Note réservée aux coachs<textarea name="coachNote">${esc(item.coachNote)}</textarea></label>${id?`<label>Échanger avec une autre séance (facultatif)<select name="swapId"><option value="">Déplacer / modifier uniquement cette séance</option>${state.sessions.filter(s=>s.id!==id).sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`<option value="${esc(s.id)}">${esc(shortDate(s.date))} · ${esc(slots[s.slot||'non-precise'])} · ${esc(s.title)}</option>`).join('')}</select><small>Les deux séances échangent leurs dates et créneaux, en conservant leurs contenus.</small></label><button type="button" class="text-button" data-archive="sessions" data-id="${esc(id)}">Archiver cette séance</button>`:''}</div>`,async form=>{
  const data=Object.fromEntries(new FormData(form));data.targets=[...form.querySelectorAll('.target-row')].map(row=>{
   const distance=Number(row.querySelector('.target-distance').value),label=row.querySelector('.target-label').value.trim();
   if(row.querySelector('.target-kind').value==='percent')return {distance,kind:'percent',label,percent:Number(row.querySelector('.target-percent').value)};
   const minTime=parseTime(row.querySelector('.target-min').value),maxTime=parseTime(row.querySelector('.target-max').value);
   if(minTime===null||maxTime===null||maxTime<minTime)throw new Error(`Plage ${distance} m : indiquez deux temps, du plus rapide au plus lent.`);
   return {distance,kind:'range',label,minTime,maxTime};
  });
  if(id)data.version=item.version;
  if(data.swapId){const other=state.sessions.find(s=>s.id===data.swapId);data.swapVersion=Number(form.elements.swapId.dataset.version);if(!other)throw new Error('La séance à échanger est introuvable.');}
  await api(id?'/sessions/'+encodeURIComponent(id):'/sessions',id?'PUT':'POST',data);selectedDate=data.date;month=fromKey(data.date);month.setDate(1);
 });
 $('#add-target').onclick=()=>$('#target-rows').insertAdjacentHTML('beforeend',targetRow());
 $('#target-rows').addEventListener('change',event=>{if(event.target.classList.contains('target-kind'))syncTargetRow(event.target.closest('.target-row'));});
 const swap=$('#editor-form').elements.swapId;
 if(swap)swap.onchange=()=>{const other=state.sessions.find(s=>s.id===swap.value);if(other){$('#editor-form').elements.date.value=other.date;$('#editor-form').elements.slot.value=other.slot||'non-precise';swap.dataset.version=other.version;}};
}
function seasonWeekOptions(selected) {
 return [2026,2027,2028].map(year=>`<optgroup label="${year}">${Array.from({length:seasonWeekCount},(_,i)=>i+1).filter(week=>fromKey(seasonWeekDate(week)).getFullYear()===year).map(week=>`<option value="${week}" ${selected===week?'selected':''}>S${week} · ${esc(shortDate(seasonWeekDate(week)))}</option>`).join('')}</optgroup>`).join('');
}
function editSeasonBand(category=null,index=null) {
 if(!coach())return;
 const original=JSON.parse(JSON.stringify(state.season));
 const current=category!==null&&index!==null?original[category]?.[index]:null;
 const initialCategory=category||'trainingPeriods';
 const start=current?.start||seasonWeekForDate(selectedDate,original)?.number||1;
 const end=current?.end||start;
 modal(current?'Modifier un repère de saison':'Ajouter un repère de saison',`<p class="help">Un repère couvre une ou plusieurs semaines entières. Pour changer ses dates, modifiez simplement la première et la dernière semaine.</p><label>Type d’information<select name="seasonCategory">${options(seasonKinds,initialCategory)}</select></label><div class="form-grid"><label>Première semaine<select name="seasonStart">${seasonWeekOptions(start)}</select></label><label>Dernière semaine<select name="seasonEnd">${seasonWeekOptions(end)}</select></label></div><label>Libellé<input name="seasonLabel" maxlength="180" value="${esc(current?.label||'')}" placeholder="Ex. Préparation spécifique, stage à Saint-Brieuc…" required></label><p class="help">Les bandes d’un même type ne doivent pas se chevaucher.</p>${current?'<button type="button" class="text-button season-delete" id="delete-season-band">Supprimer ce repère</button>':''}`,async form=>{
  const next=JSON.parse(JSON.stringify(original)),type=form.elements.seasonCategory.value;
  if(current)next[category].splice(index,1);
  const first=Number(form.elements.seasonStart.value),last=Number(form.elements.seasonEnd.value);
  if(last<first)throw new Error('La dernière semaine doit suivre la première.');
  const label=form.elements.seasonLabel.value.trim();
  next[type].push({start:first,end:last,label,tone:type===category?current?.tone||'custom':'custom'});
  await api('/season','PUT',{...next,version:original.version});
 });
 const form=$('#editor-form'),type=form.elements.seasonCategory;
 type.onchange=()=>{if(type.value==='schoolHolidays'&&!form.elements.seasonLabel.value.trim())form.elements.seasonLabel.value='Vacances scolaires IDF';};
 if(current)$('#delete-season-band').onclick=async()=>{
  if(!confirm(`Supprimer « ${current.label} » de la frise pour tout le groupe ?`))return;
  const next=JSON.parse(JSON.stringify(original));next[category].splice(index,1);
  const button=$('#delete-season-band');button.disabled=true;$('#editor-error').textContent='';
  try{await api('/season','PUT',{...next,version:original.version});$('#editor').close();state=await api('/state');render();toast('Repère supprimé pour toute l’équipe.');}
  catch(e){$('#editor-error').textContent=e.message;button.disabled=false;}
 };
}
function editSeasonLoad(week) {
 if(!coach())return;
 const original=JSON.parse(JSON.stringify(state.season));
 const choices={'':'Non renseignée',light:'Légère',medium:'Moyenne',high:'Élevée'};
 modal(`Charge de la semaine S${week}`,`<p class="help">${esc(shortDate(seasonWeekDate(week)))} · Charge hebdomadaire visible sur le calendrier et les séances, sauf lorsqu’une charge propre a été choisie dans une séance.</p><label>Charge prévue<select name="seasonLoad">${options(choices,original.weeklyLoads[week-1]||'')}</select></label>`,async form=>{
  const next=JSON.parse(JSON.stringify(original));next.weeklyLoads[week-1]=form.elements.seasonLoad.value||null;
  await api('/season','PUT',{...next,version:original.version});
 });
}
function editContent(collection,id) {
 if(!coach())return;
 const item=id?state[collection].find(s=>s.id===id):{};
 const categories=collection==='library'?{acronym:'Acronyme',circuit:'Circuit / gammes'}:{organisation:'Organisation & pratique',relationnel:'Relations & règles'};
 modal(id?'Modifier le contenu':'Ajouter un contenu',`<label>Titre<input name="title" value="${esc(item.title)}" maxlength="180" required></label><label>Catégorie<select name="category">${options(categories,item.category)}</select></label>${collection==='info'?`<label>Icône / emoji<input name="icon" value="${esc(item.icon||'')}" maxlength="16"></label>`:''}<label>Texte<textarea name="body" rows="12" maxlength="20000" required>${esc(item.body)}</textarea></label>`,async form=>{const data=Object.fromEntries(new FormData(form));if(id)data.version=item.version;await api('/'+collection+(id?'/'+encodeURIComponent(id):''),id?'PUT':'POST',data);});
}
async function archive(collection,id) {
 const item=state[collection].find(s=>s.id===id);if(!coach()||!item)return;
 if(!confirm(`Archiver « ${item.title} » ? Cet élément ne sera plus affiché au groupe.`))return;
 await api('/'+collection+'/'+encodeURIComponent(id),'DELETE',{version:item.version});$('#editor').close();state=await api('/state');render();toast('Élément archivé ; conservé dans la base du site.');
}
function deleteAccount() {
 modal('Supprimer mon profil',`<p>Votre compte, vos coordonnées et vos chronos seront définitivement supprimés. Toutes vos sessions seront fermées.</p><p class="help">Le planning, les circuits et les informations partagées du groupe sont conservés.</p><label class="checkbox"><input type="checkbox" name="confirm" required> Êtes-vous sûr de vouloir supprimer ce compte ?</label>`,async form=>{
  await api('/account','DELETE',{identifier:user.email,confirm:form.elements.confirm.checked});
  user=null;state=null;accessToken=null;csrf=null;$('#editor').close();$('#connection').hidden=true;history.replaceState(null,'','#connexion');render();toast('Votre profil et vos chronos personnels ont été supprimés.');return false;
 },'Supprimer définitivement mon profil');
}
$('#editor-form').onsubmit=async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;$('#editor-error').textContent='';
 try {const done=await editSubmit(event.currentTarget);if(done!==false){$('#editor').close();state=await api('/state');render();toast('Modifications enregistrées.');}}
 catch(e){$('#editor-error').textContent=e.message;}finally{button.disabled=false;}
};
function closeEditor(){$('#editor').close();render();}
$('#close-editor').onclick=closeEditor;$('#cancel-editor').onclick=closeEditor;
$('#editor').addEventListener('cancel',()=>setTimeout(render,0));
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 try {
  if(button.dataset.adminAction){
   const member=state.members.find(m=>m.id===button.dataset.id);if(!admin()||!member)return;
   const grant=button.dataset.adminAction==='grant-admin';
   if(!confirm(`${grant?'Nommer admin':'Retirer les droits admin de'} ${member.name} ${member.lastName} ? ${grant?'Ce rôle permet de nommer d’autres admins. Il remplace son rôle actuel.':'Le membre retrouvera son rôle précédent.'}`))return;
   await api('/members/'+encodeURIComponent(member.id)+'/admin','PUT',{action:button.dataset.adminAction,expectedRole:member.role});state=await api('/state');user=state.user;render();toast('Droits d’administration mis à jour.');return;
  }
  if(button.dataset.memberAction){
   const member=state.members.find(m=>m.id===button.dataset.id);if(!admin()||!member)return;
   const path='/members/'+encodeURIComponent(member.id),action=button.dataset.memberAction;
   if(action==='coach'){
    if(!confirm(`Modifier les droits coach de ${member.name} ${member.lastName} ?`))return;
    await api(path+'/coach','PUT',{version:member.accountVersion,action:member.role==='coach'?'revoke-coach':'grant-coach'});state=await api('/state');render();toast('Droits coach mis à jour.');return;
   }
   if(member.id===user.id)return;
   if(action==='password')return modal('Réinitialiser le mot de passe',`<p>${esc(member.name)} ${esc(member.lastName)}</p><p>Ses connexions seront fermées. Le membre pourra ensuite changer ce mot de passe dans ses réglages.</p><label>Nouveau mot de passe provisoire<input name="password" type="password" autocomplete="new-password" maxlength="1024" required></label><p class="help">Aucune règle de complexité. Les majuscules et minuscules comptent.</p>`,async form=>{
    const result=await api(path+'/password','PUT',{version:member.accountVersion,password:form.elements.password.value});
    state=await api('/state');$('#editor-fields').innerHTML=`<p>Mot de passe réinitialisé pour ${esc(member.name)}.</p><p>Mot de passe provisoire : <strong>${esc(result.temporaryPassword)}</strong></p><p class="help">Transmettez-le au membre en respectant les majuscules et minuscules.</p>`;$('#editor-form button[type=submit]').hidden=true;$('#cancel-editor').textContent='Fermer';return false;
   },'Confirmer la réinitialisation');
   if(action==='delete')return modal('Supprimer le compte d’un membre',`<p>Supprimer définitivement ${esc(member.name)} ${esc(member.lastName)} ? Ses chronos, commentaires et inscriptions seront effacés. Le contenu partagé sera conservé.</p><label class="checkbox"><input name="confirm" type="checkbox" required> Êtes-vous sûr de vouloir supprimer ce compte ?</label>`,async form=>{await api(path,'DELETE',{version:member.accountVersion,identifier:member.email,confirm:form.elements.confirm.checked});},'Supprimer définitivement');
  }
  if(button.dataset.seasonCategory)return editSeasonBand(button.dataset.seasonCategory,Number(button.dataset.seasonIndex));
  if(button.dataset.comments)return editComments(button.dataset.comments);
  if(button.dataset.competition)return editCompetition(button.dataset.competition);
  if(button.dataset.participants)return showParticipants(button.dataset.participants);
  if(button.dataset.seasonWeek)return editSeasonLoad(Number(button.dataset.seasonWeek));
  if(button.dataset.date)return selectDate(button.dataset.date);
  if(button.dataset.edit)return button.dataset.edit==='sessions'?editSession(button.dataset.id):editContent(button.dataset.edit,button.dataset.id);
  if(button.dataset.archive)return await archive(button.dataset.archive,button.dataset.id);
  if(button.dataset.percent){$('#percent').value=button.dataset.percent;return calculate();}
  if(button.classList.contains('remove-target')){button.closest('.target-row').remove();return;}
  switch(button.dataset.action){
   case 'menu':$('#navigation').classList.toggle('mobile-open');button.setAttribute('aria-expanded',$('#navigation').classList.contains('mobile-open'));break;
   case 'logout':await api('/logout','POST',{});user=null;state=null;accessToken=null;csrf=null;$('#connection').hidden=true;history.replaceState(null,'','#connexion');render();break;
   case 'today':selectDate(today());break;
   case 'prev-week':{const dt=fromKey(selectedDate);dt.setDate(dt.getDate()-7);selectDate(dateKey(dt));break;}
   case 'next-week':{const dt=fromKey(selectedDate);dt.setDate(dt.getDate()+7);selectDate(dateKey(dt));break;}
   case 'prev-month':month.setMonth(month.getMonth()-1);trainingPage();break;
   case 'next-month':month.setMonth(month.getMonth()+1);trainingPage();break;
   case 'new-session':editSession();break;
   case 'new-season-band':editSeasonBand();break;
   case 'new-competition':editCompetition();break;
   case 'new-library':editContent('library');break;
   case 'new-info':editContent('info');break;
   case 'delete-account':deleteAccount();break;
  }
 }catch(e){toast(e.message);}
});
document.addEventListener('change',async event=>{
 const input=event.target;if(!input.matches('input[data-signup]'))return;
 const registered=input.checked;input.disabled=true;
 try{await api('/competitions/'+encodeURIComponent(input.dataset.signup)+'/signup','PUT',{registered});state=await api('/state');render();toast(registered?'Votre inscription est enregistrée.':'Votre inscription a été retirée.');}catch(e){input.checked=!registered;toast(e.message);}finally{input.disabled=false;}
});
$('#navigation').addEventListener('click',event=>{
 if(!event.target.closest('a'))return;
 $('#navigation').classList.remove('mobile-open');$('#account [data-action=menu]')?.setAttribute('aria-expanded','false');
});
window.addEventListener('hashchange',()=>{if($('#editor').open)$('#editor').close();$('#navigation').classList.remove('mobile-open');render();window.scrollTo(0,0);});
async function refresh() {
 if(!user||pollBusy||document.hidden)return;pollBusy=true;const refreshToken=accessToken;
 try{
  const next=await api('/state');if(accessToken!==refreshToken||!state)return;const changed=state.revision!==next.revision;state=next;user=next.user;$('#connection').hidden=true;
  pendingRender ||= changed;
  if(pendingRender&&!$('#editor').open&&!['chronos','reglages'].includes(page())&&!['library-search','member-search'].includes(document.activeElement?.id)){render();toast('Le contenu du groupe a été mis à jour.');}
 }catch(e){if(e.status===401){user=null;state=null;accessToken=null;csrf=null;$('#editor').close();render();toast('Votre session a expiré. Reconnectez-vous.');}else{$('#connection').hidden=false;$('#connection').textContent='Connexion interrompue. Dernier planning chargé affiché ; nouvelles modifications en attente de connexion.';}}
 finally{pollBusy=false;}
}
setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
try{const auth=await api('/auth');setup=auth.setup;pendingAccount=auth.pending;render();}catch(e){$('#main').innerHTML=`<section class="card"><h1>Le site n’est pas démarré.</h1><p>Lancez « Démarrer le site.command », puis ouvrez <a href="http://localhost:8787">localhost:8787</a>.</p><p class="error">${esc(e.message)}</p></section>`;}
