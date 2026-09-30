import { distances, types, parseTime, trainingTarget, formatTime, formatSpeed, dateKey, fromKey } from './core.mjs';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots = {'non-precise':'Créneau à préciser',matin:'Matin','apres-midi':'Après-midi',soir:'Soir'};
const compactTypes={speed:'Vitesse',strength:'Muscu',vo2:'VO₂',endurance:'Endu.',hills:'Côtes',competition:'Compét.',group:'Groupe',rest:'Repos'};
const compactSlots={matin:'Matin','apres-midi':'Après-m.',soir:'Soir'};
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
 $('#main').innerHTML=`<section class="card auth-card"><p class="eyebrow">L’ESPACE PRIVÉ DU GROUPE</p><h1>${initial?'Bienvenue, Maylis.':register?'Rejoindre l’équipe.':'De retour sur la piste.'}</h1><p class="muted">${initial?'Votre profil admin est prêt. Choisissez un identifiant.':register?'Créez votre compte athlète avec un identifiant.':'Saisissez votre identifiant pour retrouver les séances et vos chronos.'}</p><form id="auth-form">
 ${(register||initial)?`<div class="form-grid"><label>Prénom<input name="name" value="${initial?esc(pendingAccount?.name):''}" autocomplete="given-name" maxlength="80" required></label><label>Nom<input name="lastName" value="${initial?esc(pendingAccount?.lastName):''}" autocomplete="family-name" maxlength="80"></label></div><label>Téléphone (facultatif)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><p class="help">Votre nom, prénom et téléphone seront visibles dans l’annuaire privé du groupe.</p>`:''}
 <label>Identifiant<input name="email" value="${initial?esc(pendingAccount?.email):''}" autocomplete="username" maxlength="180" required><small>Choisissez un identifiant unique, facile à retenir.</small></label>
 ${register?`<label class="checkbox"><input type="checkbox" name="coach" ${coachSignupHint?'checked':''}> Je suis coach</label><p class="help">Cochez cette case si vous êtes coach et devez modifier les séances pour le groupe.</p>`:''}
 <p id="auth-error" role="alert" class="error"></p><button type="submit">${initial?'Activer mon compte admin':register?'Créer mon compte':'Se connecter'}</button></form><p class="help">${register||initial?'<a href="#connexion">Déjà membre ? Connexion</a>':'Nouveau membre ? <a href="#inscription">Inscription</a>'}</p>${setup&&!initial?'<p class="help"><a href="#initialisation">Maylis : activer mon compte admin</a></p>':''}</section>`;
 $('#auth-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,fields=new FormData(form),button=form.querySelector('button[type=submit]');button.disabled=true;$('#auth-error').textContent='';
  try {
   const result=await api(initial?'/setup':register?'/register':'/login','POST',{name:fields.get('name'),lastName:fields.get('lastName'),phone:fields.get('phone'),email:fields.get('email'),coach:fields.get('coach')==='on'});
   user=result.user;csrf=result.csrf;accessToken=result.accessToken;setup=false;state=await api('/state');history.replaceState(null,'',location.pathname+'#entrainements');render();
  } catch(e){$('#auth-error').textContent=e.message;}finally{button.disabled=false;}
 };
}
function daySessions(key) {
 const items=state.sessions.filter(s=>s.date===key), active=items.filter(s=>s.type!=='rest');
 return (active.length?active:items).sort((a,b)=>['matin','apres-midi','soir','non-precise'].indexOf(a.slot||'non-precise')-['matin','apres-midi','soir','non-precise'].indexOf(b.slot||'non-precise'));
}
function selectDate(key) {selectedDate=key;month=fromKey(key);month.setDate(1);render();window.scrollTo({top:0,behavior:'smooth'});}
function weekStrip() {
 const monday=fromKey(selectedDate);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 return `<div class="week-strip">${Array.from({length:7},(_,i)=>{const dt=new Date(monday);dt.setDate(dt.getDate()+i);const key=dateKey(dt),items=daySessions(key);return `<button class="week-day ${key===selectedDate?'selected':''} ${key===today()?'today':''}" data-date="${key}" aria-label="${esc(fullDate(key))}" aria-pressed="${key===selectedDate}"><span>${dt.toLocaleDateString('fr-FR',{weekday:'short'})}</span><strong>${dt.getDate()}</strong><div class="dots">${[...new Set(items.map(s=>s.type))].map(t=>`<i class="dot type-${t}"></i>`).join('')}</div></button>`;}).join('')}</div>`;
}
function sessionCard(s) {
 const targets=s.targets||[];
 return `<article class="card session-card type-${esc(s.type)}"><div class="section-head"><div><span class="pill type-badge">${esc(types[s.type])}</span> <span class="pill">${esc(slots[s.slot||'non-precise'])}</span></div>${coach()?`<button class="secondary" data-edit="sessions" data-id="${esc(s.id)}">Modifier / déplacer</button>`:''}</div><p class="eyebrow">${esc(s.cycle||'ENTRAÎNEMENT')}</p><h2>${esc(s.title)}</h2>
 ${s.type==='rest'?`<p class="prose muted">${esc(s.workout)}</p>`:`<div class="session-parts"><section class="session-part"><h3 class="part-label"><span>01</span> Échauffement</h3><p class="prose ${!s.warmup?'muted':''}">${esc(s.warmup||'Non renseigné par le coach.')}</p></section><section class="session-part"><h3 class="part-label"><span>02</span> Séance</h3><p class="prose">${esc(s.workout||'Le détail de la séance sera précisé par le coach.')}</p>${s.v2?`<aside class="variant"><h3>Version 2</h3><p class="prose">${esc(s.v2)}</p></aside>`:''}</section></div>`}
 ${targets.length?`<div class="session-targets">${targets.map(t=>{const target=trainingTarget(state.profile.times,t.distance,t.percent);return `<div class="session-target">${t.distance} m à ${t.percent} %<strong>${target?formatTime(target.targetTime):t.distance<50||t.distance>1500?'Estimation indisponible':`<a href="#chronos">Ajouter un chrono de référence</a>`}</strong>${target?`<span class="target-meta">${formatSpeed(target.targetSpeed)} · ${target.kind==='mesuré'?'chrono saisi':'estimation'}</span>`:''}</div>`;}).join('')}</div>`:''}
 ${coach()&&s.coachNote?`<p class="coach-note"><strong>Note coach</strong><br>${esc(s.coachNote)}</p>`:''}</article>`;
}
function calendar() {
 const start=(month.getDay()+6)%7,count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 return `<section class="card"><div class="section-head"><div><p class="eyebrow">LE CALENDRIER DE L’ÉQUIPE</p><h2>${esc(month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}))}</h2></div><div class="actions"><button class="icon-button" data-action="prev-month" aria-label="Mois précédent">←</button><button class="icon-button" data-action="next-month" aria-label="Mois suivant">→</button></div></div><div class="legend">${Object.entries(types).map(([k,v])=>`<span><i class="dot type-${k}"></i>${esc(v)}</span>`).join('')}</div><div class="weekdays">${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${'<div class="calendar-day blank"></div>'.repeat(start)}${Array.from({length:count},(_,i)=>{const dt=new Date(month.getFullYear(),month.getMonth(),i+1),key=dateKey(dt),items=daySessions(key);return `<button class="calendar-day ${key===selectedDate?'selected':''} ${key===today()?'today':''}" data-date="${key}" aria-label="${esc(fullDate(key))} : ${esc(items.map(s=>s.title).join(', ')||'Aucune séance renseignée')}" aria-pressed="${key===selectedDate}"><strong>${i+1}</strong>${items.map(s=>`<span class="event-label type-${s.type}"><span class="event-full">${s.slot&&s.slot!=='non-precise'?esc(slots[s.slot])+' · ':''}${esc(types[s.type])}</span><span class="event-short">${compactSlots[s.slot]?`<small>${esc(compactSlots[s.slot])}</small>`:''}${esc(compactTypes[s.type])}</span></span>`).join('')}</button>`;}).join('')}</div><p class="footer-note">Cliquez sur un jour pour consulter ${coach()?'ou ajouter ':''}ses séances.</p></section>`;
}
function trainingPage() {
 const items=daySessions(selectedDate);
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">${esc(fullDate(selectedDate))}</p><h1>${selectedDate===today()?'Aujourd’hui, sur la piste.':'Votre journée d’entraînement.'}</h1><p class="muted">${items.filter(s=>s.type!=='rest').length} séance(s) · ${esc(user.name)}</p></div><div class="actions"><button class="secondary" data-action="today">Aujourd’hui</button>${coach()?'<button data-action="new-session">+ Séance</button>':''}</div></div>${weekStrip()}<div id="daily-sessions">${items.length?items.map(sessionCard).join(''):'<section class="card empty-state"><h2>Aucune séance renseignée</h2><p>Le planning de cette journée n’a pas encore été renseigné.</p></section>'}</div>${calendar()}`;
}
function chronoPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">MON ESPACE PERSONNEL</p><h1>Mes chronos, mes allures.</h1><p class="muted">Ces références appartiennent uniquement à ${esc(user.name)}.</p></div><span class="pill">Privé</span></div>
 <section class="card"><div class="section-head"><h2>Mes temps de référence</h2></div><p class="help">Renseignez seulement les distances connues, en secondes (54,32) ou minutes:secondes (1:02,50). Une case vide signifie « chrono inconnu ».</p><form id="chrono-form" data-version="${state.profileVersion}"><div class="chrono-grid">${distances.map(d=>`<label>${d} m<input name="time-${d}" inputmode="decimal" placeholder="—" value="${esc(state.profile.times?.[d]?.toString().replace('.',',')||'')}" aria-label="Chrono ${d} mètres"></label>`).join('')}</div><p class="error" id="chrono-error" role="alert"></p><div class="form-actions"><button type="submit">Enregistrer mes chronos</button></div></form></section>
 <section class="card"><div class="calculator-head"><div><p class="eyebrow">CALCULATEUR PERSONNEL</p><h2>Les temps à viser</h2><p class="help">Choisissez la distance de la séance, même si vous n’avez pas de chrono sur celle-ci.</p></div><div class="calculator-fields"><label>Distance à courir (m)<input id="target-distance" type="number" min="50" max="1500" step="1" value="250"></label><label>Intensité souhaitée (%)<input id="percent" type="number" min="0.1" max="150" step="0.1" value="80"></label></div></div><div class="actions"><button class="secondary" data-percent="80">80 %</button><button class="secondary" data-percent="85">85 %</button><button class="secondary" data-percent="89">89 %</button><button class="secondary" data-percent="90">90 %</button></div><p class="help formula">Le site estime d’abord votre chrono sur la distance choisie à partir de vos chronos connus. Il applique ensuite le pourcentage à la vitesse en m/s, comme dans le tableau du coach. Les chronos saisis restent des points exacts de la courbe.</p><div id="results" class="result-grid"></div></section>`;
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
function groupPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">L’ANNUAIRE PRIVÉ</p><h1>Les visages du groupe.</h1><p class="muted">${state.members.length} membre(s) · Coordonnées visibles uniquement après connexion.</p></div></div><section class="card"><label class="search">Rechercher un membre<input id="member-search" type="search" placeholder="Prénom ou nom…"></label><div class="table-scroll"><table><thead><tr><th>Prénom</th><th>Nom</th><th>Téléphone</th><th>Profil</th></tr></thead><tbody id="member-rows"></tbody></table></div></section>`;
 const draw=()=>{const query=$('#member-search').value.toLocaleLowerCase('fr');$('#member-rows').innerHTML=state.members.filter(m=>(m.name+' '+m.lastName).toLocaleLowerCase('fr').includes(query)).map(m=>`<tr><td><strong>${esc(m.name)}</strong>${m.id===user.id?' <small>(vous)</small>':''}</td><td>${esc(m.lastName)||'—'}</td><td>${esc(m.phone)||'<span class="muted">Non renseigné</span>'}</td><td><span class="pill">${roleLabel(m.role)}</span></td></tr>`).join('');};$('#member-search').oninput=draw;draw();
}
function settingsPage() {
 $('#main').innerHTML=`<div class="page-intro"><div><p class="eyebrow">MON COMPTE</p><h1>Mes réglages.</h1><p class="muted">Votre identité et vos coordonnées dans le groupe.</p></div></div><section class="card"><div class="section-head"><div><h2>${esc(user.name)} ${esc(user.lastName)}</h2><p>Identifiant : ${esc(user.email)}</p></div><span class="pill">Profil ${roleLabel(user.role).toLowerCase()}</span></div><p class="help">${admin()?'Vous gérez les droits d’administration. Les membres choisissent leur rôle athlète ou coach lors de l’inscription. Vos chronos restent personnels ; l’édition des séances est réservée aux coachs.':coach()?'Vous pouvez modifier les entraînements, les circuits et les informations pour toute l’équipe. Vos chronos restent personnels.':'Vous pouvez consulter le planning du groupe et gérer vos chronos personnels. Le coach se charge du contenu partagé.'}</p><form id="settings-form" data-version="${user.accountVersion}"><div class="form-grid"><label>Prénom<input name="name" value="${esc(user.name)}" autocomplete="given-name" maxlength="80" required></label><label>Nom<input name="lastName" value="${esc(user.lastName)}" autocomplete="family-name" maxlength="80"></label><label class="full-width">Téléphone<input name="phone" type="tel" value="${esc(user.phone)}" autocomplete="tel" maxlength="40"><small>Visible par les membres connectés dans « Le groupe ». Vous pouvez laisser ce champ vide.</small></label></div><p class="error" id="settings-error" role="alert"></p><div class="form-actions"><button type="submit">Enregistrer mes coordonnées</button></div></form></section>`;
 const lastAdmin=admin()&&state.members.filter(m=>m.role==='admin').length===1;
 $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Supprimer mon profil</h2><p class="help">Cette action supprime définitivement votre compte, vos coordonnées et vos chronos. Les séances et informations du groupe restent disponibles pour l’équipe.</p>${lastAdmin?'<p class="help">Vous êtes le dernier admin : nommez un autre administrateur ci-dessous avant de supprimer votre profil.</p>':''}<button class="secondary danger-button" data-action="delete-account" ${lastAdmin?'disabled':''}>Supprimer mon profil</button></section>`);
 if(admin()){
  const count=state.members.filter(m=>m.role==='admin').length;
  $('#main').insertAdjacentHTML('beforeend',`<section class="card"><h2>Administrateurs du site</h2><p class="help">Pour transmettre le site, nommez un membre admin, puis retirez vos propres droits si vous le souhaitez. Un admin gère les droits admin ; l’édition des séances appartient aux comptes coach.</p><div class="table-scroll"><table><thead><tr><th>Membre</th><th>Profil</th><th>Administration</th></tr></thead><tbody>${state.members.map(m=>`<tr><td>${esc(m.name)} ${esc(m.lastName)}${m.id===user.id?' (vous)':''}</td><td>${roleLabel(m.role)}</td><td><button class="secondary" data-admin-action="${m.role==='admin'?'revoke-admin':'grant-admin'}" data-id="${esc(m.id)}" ${m.role==='admin'&&count===1?'disabled title="Le dernier admin ne peut pas être retiré"':''}>${m.role==='admin'?'Retirer les droits admin':'Nommer admin'}</button></td></tr>`).join('')}</tbody></table></div><p class="help">Il doit rester au moins un admin. Si les droits admin sont retirés, le membre retrouve son rôle précédent.</p></section>`);
 }
 $('#settings-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;$('#settings-error').textContent='';try{await api('/account','PUT',{...Object.fromEntries(new FormData(form)),version:Number(form.dataset.version)});state=await api('/state');user=state.user;render();toast('Vos coordonnées sont enregistrées.');}catch(e){$('#settings-error').textContent=e.message;}finally{button.disabled=false;}};
}
function render() {
 pendingRender=false;header();if(!user)return authPage();if(!state)return;
 if(page()==='chronos')chronoPage();else if(page()==='bibliotheque')libraryPage();else if(page()==='infos')infoPage();else if(page()==='groupe')groupPage();else if(page()==='reglages')settingsPage();else trainingPage();
}
function modal(title,html,onSubmit,submitText='Enregistrer pour l’équipe') {
 $('#editor-title').textContent=title;$('#editor-fields').innerHTML=html;$('#editor-error').textContent='';editSubmit=onSubmit;
 const button=$('#editor-form button[type=submit]');button.textContent=submitText;button.disabled=false;$('#editor').showModal();
}
function targetRow(value={distance:200,percent:80}) {return `<div class="target-row"><label>Distance (m)<input type="number" class="target-distance" min="1" max="10000" step="1" value="${esc(value.distance)}" required></label><label>Vitesse (%)<input type="number" class="target-percent" min="0.1" max="150" step="0.1" value="${esc(value.percent)}" required></label><button type="button" class="secondary remove-target" aria-label="Retirer cette allure">×</button></div>`;}
function editSession(id) {
 if(!coach())return;
 const item=id?state.sessions.find(s=>s.id===id):{date:selectedDate,slot:'non-precise',type:'speed',targets:[]};
 modal(id?'Modifier la séance':'Ajouter une séance',`<div class="form-grid"><label class="full-width">Titre<input name="title" value="${esc(item.title)}" maxlength="180" required></label><label>Date<input name="date" type="date" value="${item.date}" required></label><label>Créneau<select name="slot">${options(slots,item.slot||'non-precise')}</select></label><label>Type de séance<select name="type">${options(types,item.type)}</select></label><label>Cycle / période<input name="cycle" value="${esc(item.cycle)}"></label><label class="full-width">Échauffement<textarea name="warmup">${esc(item.warmup)}</textarea></label><label class="full-width">Séance<textarea name="workout" rows="6">${esc(item.workout)}</textarea></label><label class="full-width">Version 2 — facultative<textarea name="v2">${esc(item.v2)}</textarea><small>Visible automatiquement par les athlètes si renseignée.</small></label></div><div class="editor-section"><h3>Temps cibles personnels</h3><p class="help">Une cible ne sera calculée que si l’athlète a renseigné son chrono sur cette distance.</p><div id="target-rows">${(item.targets||[]).map(targetRow).join('')}</div><button type="button" class="secondary" id="add-target">+ Distance et pourcentage</button></div><div class="editor-section"><label>Note réservée aux coachs<textarea name="coachNote">${esc(item.coachNote)}</textarea></label>${id?`<label>Échanger avec une autre séance (facultatif)<select name="swapId"><option value="">Déplacer / modifier uniquement cette séance</option>${state.sessions.filter(s=>s.id!==id).sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`<option value="${esc(s.id)}">${esc(shortDate(s.date))} · ${esc(slots[s.slot||'non-precise'])} · ${esc(s.title)}</option>`).join('')}</select><small>Les deux séances échangent leurs dates et créneaux, en conservant leurs contenus.</small></label><button type="button" class="text-button" data-archive="sessions" data-id="${esc(id)}">Archiver cette séance</button>`:''}</div>`,async form=>{
  const data=Object.fromEntries(new FormData(form));data.targets=[...form.querySelectorAll('.target-row')].map(row=>({distance:Number(row.querySelector('.target-distance').value),percent:Number(row.querySelector('.target-percent').value)}));
  if(id)data.version=item.version;
  if(data.swapId){const other=state.sessions.find(s=>s.id===data.swapId);data.swapVersion=Number(form.elements.swapId.dataset.version);if(!other)throw new Error('La séance à échanger est introuvable.');}
  await api(id?'/sessions/'+encodeURIComponent(id):'/sessions',id?'PUT':'POST',data);selectedDate=data.date;month=fromKey(data.date);month.setDate(1);
 });
 $('#add-target').onclick=()=>$('#target-rows').insertAdjacentHTML('beforeend',targetRow());
 const swap=$('#editor-form').elements.swapId;
 if(swap)swap.onchange=()=>{const other=state.sessions.find(s=>s.id===swap.value);if(other){$('#editor-form').elements.date.value=other.date;$('#editor-form').elements.slot.value=other.slot||'non-precise';swap.dataset.version=other.version;}};
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
 modal('Supprimer mon profil',`<p>Votre compte, vos coordonnées et vos chronos seront définitivement supprimés. Toutes vos sessions seront fermées.</p><p class="help">Le planning, les circuits et les informations partagées du groupe sont conservés.</p><label>Confirmez votre identifiant<input name="identifier" required></label><label class="checkbox"><input type="checkbox" name="confirm" required> Je confirme la suppression définitive de mon profil.</label>`,async form=>{
  await api('/account','DELETE',{identifier:form.elements.identifier.value,confirm:form.elements.confirm.checked});
  user=null;state=null;accessToken=null;csrf=null;$('#editor').close();$('#connection').hidden=true;history.replaceState(null,'','#connexion');render();toast('Votre profil et vos chronos personnels ont été supprimés.');return false;
 },'Supprimer définitivement mon profil');
}
$('#editor-form').onsubmit=async event=>{
 event.preventDefault();const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;$('#editor-error').textContent='';
 try {const done=await editSubmit(event.currentTarget);if(done!==false){$('#editor').close();state=await api('/state');render();toast('Modifications enregistrées pour toute l’équipe.');}}
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
  if(button.dataset.date)return selectDate(button.dataset.date);
  if(button.dataset.edit)return button.dataset.edit==='sessions'?editSession(button.dataset.id):editContent(button.dataset.edit,button.dataset.id);
  if(button.dataset.archive)return await archive(button.dataset.archive,button.dataset.id);
  if(button.dataset.percent){$('#percent').value=button.dataset.percent;return calculate();}
  if(button.classList.contains('remove-target')){button.closest('.target-row').remove();return;}
  switch(button.dataset.action){
   case 'menu':$('#navigation').classList.toggle('mobile-open');button.setAttribute('aria-expanded',$('#navigation').classList.contains('mobile-open'));break;
   case 'logout':await api('/logout','POST',{});user=null;state=null;accessToken=null;csrf=null;$('#connection').hidden=true;history.replaceState(null,'','#connexion');render();break;
   case 'today':selectDate(today());break;
   case 'prev-month':month.setMonth(month.getMonth()-1);trainingPage();break;
   case 'next-month':month.setMonth(month.getMonth()+1);trainingPage();break;
   case 'new-session':editSession();break;
   case 'new-library':editContent('library');break;
   case 'new-info':editContent('info');break;
   case 'delete-account':deleteAccount();break;
  }
 }catch(e){toast(e.message);}
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
