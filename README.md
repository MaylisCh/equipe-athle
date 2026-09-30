# Équipe Athlé

## Ouvrir le site sur ce Mac

1. Double-cliquer sur **Démarrer le site.command** dans ce dossier.
2. Ouvrir **http://localhost:8787** dans un navigateur. Garder la fenêtre Terminal ouverte.
3. Lors de la toute première utilisation, cliquer sur **Maylis : activer mon compte admin**. Le profil **Maylis Chancerelle** est préparé ; choisir un identifiant.
4. Pour arrêter : Ctrl+C dans le Terminal.

Il faut maintenant utiliser l’adresse du serveur, et non ouvrir `index.html` par double-clic. Le serveur peut aussi se lancer avec `npm start` (Node ≥ 22.16 requis ; aucune dépendance serveur à installer).

## Comptes et données personnelles

- Chaque ouverture ou rechargement de la page demande une connexion par identifiant. La navigation interne garde la session active.
- Un compte ne demande pas de mot de passe. Toute personne qui connaît l’identifiant peut ouvrir ce profil ; les droits du profil s’appliquent également.
- Un compte coach possède ses propres chronos, exactement comme un athlète. Aucun endpoint ne permet de lire ou de modifier les chronos d’un autre compte.
- Chaque membre s’inscrit librement depuis **Inscription**, sans invitation. Le formulaire propose la case **Je suis coach** : si elle est cochée, le compte peut modifier les contenus du groupe. Ne partagez le lien du site qu’avec l’équipe.
- Un membre ne peut pas s’accorder les droits d’administration : un admin doit le nommer depuis **Réglages**.

## Entraînements

- Planning daté : les journées importées vont du 28 septembre 2026 au 23 janvier 2027. Une journée vide signifie « aucune séance renseignée », pas nécessairement repos.
- La vue initiale sélectionne la date courante. Le calendrier et les boutons de semaine permettent de sélectionner une autre date.
- Le calendrier peut avancer sans limite, donc jusqu’en août 2028 et au-delà. Aucune séance n’est inventée : les dates sans contenu restent vides et le coach peut y ajouter des séances.
- Sur le site Cloudflare, un nettoyage vérifié au plus une fois par jour supprime définitivement les séances vieilles de plus de 90 jours (environ trois mois). Les séances futures, les profils, les chronos, la bibliothèque et les infos du groupe ne sont pas touchés. Il s’exécute lors d’un accès au site, sans tâche planifiée séparée.
- Plusieurs séances peuvent exister le même jour : matin, après-midi, soir ou créneau non précisé.
- Un jour importé comme repos peut recevoir une séance. Lorsqu’une séance active existe, la carte « Repos » initiale est masquée sans être supprimée.
- Le coach peut créer, modifier, déplacer ou archiver une séance. Changer sa date suffit à déplacer son contenu. L’option « Échanger » permute les dates et créneaux de deux séances en une seule transaction.
- Chaque séance comporte **Échauffement**, **Séance**, et une **Version 2** facultative, visible dans un encadré vert sans bouton.
- Le coach peut ajouter, sur une même séance, des cibles distance/pourcentage et des plages fixes de temps. Une plage peut porter une étiquette libre (« Filles », « Garçons », « Tous »). Les deux plages sont visibles par tous ; le site ne déduit pas le groupe d’un athlète. Une plage fixe reste la consigne du coach, avec en complément son intensité équivalente calculée sur la courbe personnelle (50 à 1 500 m) si des chronos sont renseignés.
- La feuille annuelle de l’Excel indique une **charge par semaine**, non un indice individuel pour chaque séance. Le site reprend ce niveau comme contexte « Charge semaine : légère / moyenne / élevée » dans les séances et sous forme de 1, 2 ou 3 barres dans le calendrier. Le coach peut choisir une charge propre à une séance dans l’éditeur, ou masquer l’indication. Les couleurs du type de séance restent indépendantes. Au-delà des semaines renseignées dans la feuille, aucune charge n’est inventée.
- Les notes coach ne sont transmises qu’aux comptes coach.

## Chronos

Les références acceptées sont 50, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000 et 1500 m. On peut laisser des champs vides. Formats : `54,32`, `54.32`, `1:02,50`.

Chaque chrono saisi est un point exact de la courbe personnelle. Entre deux chronos connus, le modèle interpole la fatigue ; en dehors des distances connues, il extrapole et l’interface signale cette incertitude. Les coefficients de secours pour 100–200, 200–400, 400–800 et 800–1 500 m utilisent les rapports de vitesse médians [KsA publiés ici](https://pmc.ncbi.nlm.nih.gov/articles/PMC12181339/) ; de 50 à 100 m, le profil d’accélération est une hypothèse (`exposant 0,90`). Ces coefficients ne sont pas des correspondances entre athlètes tirées du classeur : sa feuille **Temps** contient des grilles indépendantes par distance, pas de chronos appariés.

Pour la distance demandée, le calcul suit la vitesse comme dans la feuille du coach : **vitesse de référence = distance / chrono connu ou estimé**, **vitesse cible = vitesse de référence × pourcentage / 100**, puis **temps cible = distance / vitesse cible**. Les pourcentages restent libres entre 0 et 150 %, avec des raccourcis à 80, 85 et 89 %. Si la référence est connue sur la même distance, les résultats correspondent aux tableaux du classeur, sauf ses erreurs de copie : les 10 lignes du bloc « 500 m à 85 % » y calculent 80 % ; un en-tête « 250 m à 85 % » couvre en fait un bloc calculé à 89 %. Le site suit le pourcentage choisi, sans reprendre ces erreurs. Les pourcentages ambigus d’une séance ne sont pas transformés en cibles sans référence explicite du coach.

## Bibliothèque et infos du groupe

Le coach peut ajouter, modifier ou archiver les acronymes, circuits et informations. Les paragraphes fournis en début d’année sont conservés, regroupés sous « Organisation & pratique » et « Relations & règles du groupe ». Ils ne sont accessibles qu’après connexion.

Les modifications sont enregistrées dans la base commune et récupérées automatiquement par les autres sessions ouvertes chaque minute et au retour dans l’onglet. Les formulaires en cours de saisie ne sont pas remplacés. Si deux coachs modifient le même élément, la seconde sauvegarde reçoit un avertissement de conflit plutôt que d’écraser la première.

## Navigation et annuaire

Après connexion, le site affiche toujours le planning. Les boutons de navigation sont dans la barre latérale sur ordinateur ; sur téléphone, le bouton « Menu » ouvre la liste des pages.

**Réglages** permet de modifier uniquement ses propres identifiant de connexion, prénom, nom et téléphone et de consulter son rôle admin/coach/athlète. Le rôle n’est pas modifiable depuis le formulaire personnel. Un identifiant déjà utilisé est refusé ; après un changement, il faut utiliser le nouvel identifiant pour se reconnecter. Les chronos et le rôle restent liés au même profil.

Un **admin** gère les droits d’administration ; il n’édite pas les séances. Un **coach** édite les contenus communs. Chaque profil, admin compris, a ses propres chronos.

Dans **Réglages → Administrateurs du site**, un admin peut nommer un membre déjà inscrit, puis retirer ses propres droits pour transmettre le site. On ne peut jamais retirer le dernier admin. Les actions sont journalisées côté serveur et prennent effet immédiatement. Un membre qui perd ses droits admin retrouve son rôle précédent (coach ou athlète). Lorsqu’un coach est nommé admin, son rôle admin remplace son rôle coach.

**Le groupe** affiche un tableau des membres (prénom, nom, téléphone, rôle), avec recherche. Seuls les comptes connectés y accèdent. Aucun chrono ni adresse e-mail des autres membres n’y est transmis. Le téléphone est facultatif et peut être retiré des réglages.

**Réglages → Supprimer mon profil** efface définitivement le compte, ses coordonnées et ses chronos, après confirmation par identifiant. Les contenus partagés du groupe sont conservés. Le dernier admin doit d’abord nommer un successeur. Il n’y a pas de suppression du compte d’un autre membre dans cette interface.

## Documents source

Les Word et Excel du dossier parent sont exclusivement lus. Aucun traitement n’écrit dedans.

- `Saison hivernale…xlsx` fournit les séances des cycles, datées à partir du lundi de chaque semaine. Les semaines incomplètes restent incomplètes.
- Le Word d’une semaine antérieure fournit uniquement les définitions et circuits. Ses séances ne sont pas mélangées au calendrier des cycles.
- `Muscu 2309.xlsx` n’est pas affecté arbitrairement à la séance de force excentrique d’un autre cycle.
- Une note coach signale que la consigne du 1er octobre indique `(800)`, alors que `2×250 + 2×200` totalise 900 m. Le texte original est conservé, sans correction du document.

`import_sources.py` régénère le fichier de préparation `seed.json` à partir du classeur en lecture seule. Il ne remplace pas les données déjà éditées dans la base. La base n’utilise les contenus initiaux qu’à sa première création.

## Hébergement gratuit et installation sur téléphone

Le site est une application web installable (PWA) : le groupe l’ouvre avec un lien, puis chacun peut l’ajouter à l’écran d’accueil de son téléphone. Les mises à jour publiées sur GitHub sont déployées automatiquement.

Déploiement gratuit sur Cloudflare Pages :

1. Dans Cloudflare, ouvrir **Workers & Pages → Create application → Pages → Connect to Git** et choisir le dépôt privé `MaylisCh/equipe-athle`.
2. Renseigner `npm run build` comme commande de build et `dist` comme dossier de sortie.
3. Dans **Storage & Databases → D1**, créer une base, par exemple `equipe-athle`. Dans le projet Pages, **Settings → Bindings → Add → D1 database**, la relier avec le nom `DB`, puis relancer le déploiement. La base est initialisée avec les séances importées, les acronymes et les infos du groupe lors du premier accès.
4. Attendre le déploiement, ouvrir l’adresse `pages.dev` et activer le compte admin Maylis. Partager ce lien avec l’équipe.

Cloudflare Pages héberge le site et Pages Functions ; D1 stocke les séances, comptes, chronos et coordonnées. Le forfait Workers Free inclut actuellement D1 avec jusqu’à 500 Mo par base (5 Go au total), 5 millions de lignes lues et 100 000 lignes écrites par jour. Si une limite journalière est atteinte, les requêtes concernées reprennent à la remise à zéro. Les identifiants sans mot de passe sont simples, mais ne vérifient pas l’identité de la personne qui les saisit.

Sur iPhone/iPad, ouvrir le lien dans Safari puis choisir **Partager → Sur l’écran d’accueil**. Sur Android, ouvrir le menu du navigateur puis choisir **Installer l’application** ou **Ajouter à l’écran d’accueil**.

Les fichiers exposés sur le site sont construits dans `dist/`. La base, les sources Excel/Word, le code du serveur local et les autres fichiers du dépôt ne sont pas servis comme fichiers publics.

## Vérifications techniques

`npm test` vérifie le serveur local Node, les comptes par identifiant, les droits de rôle, les séances et les calculs. Il utilise une base temporaire distincte ; l’API Cloudflare utilise D1.

`npm run test:browser` vérifie les parcours dans Chromium avec trois comptes temporaires, les droits admin, les séances multiples, la mise à jour entre onglets, l’annuaire et l’affichage mobile. Installer au préalable les dépendances de développement avec `npm install`, puis le navigateur avec `npx playwright install chromium`. Les captures de vérification sont dans `test-results`.

Le serveur local utilise les modules intégrés de Node : [SQLite](https://nodejs.org/api/sqlite.html) et [crypto](https://nodejs.org/api/crypto.html). La version hébergée utilise les Pages Functions et D1. Les identifiants n’ont pas de mot de passe ; un jeton temporaire garde la connexion active dans l’onglet.
