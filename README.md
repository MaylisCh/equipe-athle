# Équipe Athlé

## Ouvrir le site sur ce Mac

1. Double-cliquer sur **Démarrer le site.command** dans ce dossier.
2. Ouvrir **http://localhost:8787** dans un navigateur. Garder la fenêtre Terminal ouverte.
3. Lors de la toute première utilisation, cliquer sur **Maylis : activer mon compte admin**. Le profil **Maylis Chancerelle**, identifiant `maylis`, est préparé. Choisir un mot de passe d’au moins 12 caractères.
4. Pour arrêter : Ctrl+C dans le Terminal.

Il faut maintenant utiliser l’adresse du serveur, et non ouvrir `index.html` par double-clic. Le serveur peut aussi se lancer avec `npm start` (Node ≥ 22.16 requis ; aucune dépendance serveur à installer).

## Comptes et données personnelles

- Chaque ouverture ou rechargement de la page demande une connexion. La navigation interne entre les pages garde la session active.
- La session n’est conservée ni dans un cookie, ni dans le stockage du navigateur : son jeton reste en mémoire dans l’onglet. Deux onglets peuvent ainsi utiliser deux comptes différents.
- Les sessions expirent après 12 heures, même si l’onglet reste ouvert. Déconnexion les révoque immédiatement.
- Un compte coach possède ses propres chronos, exactement comme un athlète. Aucun endpoint ne permet de lire ou de modifier les chronos d’un autre compte.
- Les athlètes s’inscrivent librement depuis **Inscription**, sans invitation.
- Un administrateur crée une invitation coach depuis **Le groupe**, **Infos du groupe** ou **Réglages** et transmet personnellement son lien. Les invitations sont à usage unique et expirent après 7 jours.
- Le formulaire **Inscription** propose la case **Je suis coach**. Pour obtenir ces droits, il faut une invitation coach. Un athlète ne peut pas s’accorder les droits d’administration.

## Entraînements

- Planning daté : les journées importées vont du 28 septembre 2026 au 23 janvier 2027. Une journée vide signifie « aucune séance renseignée », pas nécessairement repos.
- La vue initiale sélectionne la date courante. Le calendrier et les boutons de semaine permettent de sélectionner une autre date.
- Plusieurs séances peuvent exister le même jour : matin, après-midi, soir ou créneau non précisé.
- Un jour importé comme repos peut recevoir une séance. Lorsqu’une séance active existe, la carte « Repos » initiale est masquée sans être supprimée.
- Le coach peut créer, modifier, déplacer ou archiver une séance. Changer sa date suffit à déplacer son contenu. L’option « Échanger » permute les dates et créneaux de deux séances en une seule transaction.
- Chaque séance comporte **Échauffement**, **Séance**, et une **Version 2** facultative, visible dans un encadré vert sans bouton.
- Les allures sont des couples distance/pourcentage définis par le coach. Elles se calculent uniquement si le membre connaît sa référence sur la même distance.
- Les notes coach ne sont transmises qu’aux comptes coach.

## Chronos

Les références acceptées sont 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000 et 1500 m. On peut laisser des champs vides. Formats : `54,32`, `54.32`, `1:02,50`.

La formule est **temps cible = temps de référence / (pourcentage / 100)**. Elle s’applique à la même distance : 24 s sur 200 m donne 30 s à 80 %. Pas d’extrapolation automatique d’une distance à l’autre. Les pourcentages ambigus d’une séance ne sont pas transformés en cibles sans référence explicite du coach.

## Bibliothèque et infos du groupe

Le coach peut ajouter, modifier ou archiver les acronymes, circuits et informations. Les paragraphes fournis en début d’année sont conservés, regroupés sous « Organisation & pratique » et « Relations & règles du groupe ». Ils ne sont accessibles qu’après connexion.

Les modifications sont enregistrées dans la base commune et récupérées automatiquement par les autres sessions ouvertes toutes les 10 secondes. Les formulaires en cours de saisie ne sont pas remplacés. Si deux coachs modifient le même élément, la seconde sauvegarde reçoit un avertissement de conflit plutôt que d’écraser la première.

## Navigation et annuaire

Après connexion, le site affiche toujours le planning. Les boutons de navigation sont dans la barre latérale sur ordinateur ; sur téléphone, le bouton « Menu » ouvre la liste des pages.

**Réglages** permet de modifier uniquement ses propres prénom, nom et téléphone et de consulter son rôle admin/coach/athlète. Le rôle n’est pas modifiable depuis le formulaire personnel.

Un **admin** gère les invitations coach et les droits d’administration ; il n’édite pas les séances. Un **coach** édite les contenus communs. Chaque profil, admin compris, a ses propres chronos.

Dans **Réglages → Administrateurs du site**, un admin peut nommer un membre déjà inscrit, puis retirer ses propres droits pour transmettre le site. On ne peut jamais retirer le dernier admin. Les actions sont journalisées côté serveur et prennent effet immédiatement. Un membre qui perd ses droits admin retrouve son rôle précédent (coach ou athlète). Lorsqu’un coach est nommé admin, son rôle admin remplace son rôle coach.

**Le groupe** affiche un tableau des membres (prénom, nom, téléphone, rôle), avec recherche. Seuls les comptes connectés y accèdent. Aucun chrono ni adresse e-mail des autres membres n’y est transmis. Le téléphone est facultatif et peut être retiré des réglages.

**Réglages → Supprimer mon profil** efface définitivement le compte, ses coordonnées et ses chronos, après confirmation par mot de passe. Toutes les sessions du compte sont révoquées. Les contenus partagés du groupe sont conservés. Le dernier admin doit d’abord nommer un successeur. Il n’y a pas de suppression du compte d’un autre membre dans cette interface.

## Documents source

Les Word et Excel du dossier parent sont exclusivement lus. Aucun traitement n’écrit dedans.

- `Saison hivernale…xlsx` fournit les séances des cycles, datées à partir du lundi de chaque semaine. Les semaines incomplètes restent incomplètes.
- Le Word d’une semaine antérieure fournit uniquement les définitions et circuits. Ses séances ne sont pas mélangées au calendrier des cycles.
- `Muscu 2309.xlsx` n’est pas affecté arbitrairement à la séance de force excentrique d’un autre cycle.
- Une note coach signale que la consigne du 1er octobre indique `(800)`, alors que `2×250 + 2×200` totalise 900 m. Le texte original est conservé, sans correction du document.

`import_sources.py` régénère le fichier de préparation `seed.json` à partir du classeur en lecture seule. Il ne remplace pas les données déjà éditées dans la base. La base n’utilise les contenus initiaux qu’à sa première création.

## Partage et hébergement

Cette version est fonctionnelle **sur un serveur local**, avec comptes et base partagée. `localhost` désigne ce Mac : ce lien n’est pas encore utilisable depuis les téléphones de l’équipe.

Pour obtenir un site internet classique, le chemin recommandé est :

1. Mettre ce dossier dans un dépôt GitHub privé.
2. Connecter ce dépôt à Render avec le fichier `render.yaml`.
3. Créer le service depuis le Blueprint Render. Le disque persistant `/var/data` est défini dans `render.yaml`; il conserve la base SQLite quand le site redémarre.
4. Ouvrir l’URL Render et cliquer sur **Maylis : activer mon compte admin**. Choisir l’identifiant et le mot de passe du compte Maylis. La première personne qui fait cette activation obtient le rôle admin.
5. Une fois le premier admin activé, les inscriptions athlètes et les invitations coach se gèrent depuis le site.

Render fournit automatiquement `RENDER_EXTERNAL_URL`, utilisé comme adresse HTTPS du site si `APP_ORIGIN` n’est pas défini. Pour un autre hébergeur Node, déployer **une seule instance** avec :

- `NODE_ENV=production`
- `APP_ORIGIN=https://adresse-du-site` si l’hébergeur ne fournit pas `RENDER_EXTERNAL_URL`
- `HOST=0.0.0.0`
- `PORT` selon l’hébergeur
- `ATHLE_DATA_DIR` vers un dossier persistant privé

Placer le service derrière HTTPS, garder une seule instance active avec la base SQLite, configurer les limites de requêtes et sauvegarder le disque persistant. Le mot de passe oublié n’a pas encore de récupération par e-mail ; cela dépendra de l’hébergement et d’un service d’envoi choisi.

La base SQLite est `data/athle.sqlite`. Les archives sont conservées en base (`archived=1`) et ne sont plus affichées. Pour sauvegarder manuellement, arrêter le serveur puis copier le dossier `data` dans un emplacement privé. Ne pas publier `data`, les sources de contenu, ni les documents du coach dans un hébergement statique.

## Vérifications techniques

`npm test` vérifie les droits côté serveur, les comptes et chronos indépendants, les invitations (dont refus d’élévation de droits), les échanges de séances, les séances multiples, les conflits et la persistance après redémarrage, ainsi que les calculs. Ces tests utilisent une base temporaire distincte.

`npm run test:browser` vérifie les parcours dans Chromium avec trois comptes temporaires, les droits admin, les séances multiples, la mise à jour entre onglets, l’annuaire et l’affichage mobile. Installer au préalable les dépendances de développement avec `npm install`, puis le navigateur avec `npx playwright install chromium`. Les captures de vérification sont dans `test-results`.

Le serveur utilise les modules intégrés de Node : [SQLite](https://nodejs.org/api/sqlite.html) et [crypto](https://nodejs.org/api/crypto.html). Les mots de passe sont hachés avec scrypt et sel individuel ; les jetons sont stockés hachés côté serveur. Le serveur ne sert que les fichiers publics nécessaires au navigateur.
