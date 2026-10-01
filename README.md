# Équipe 400/4H

## Ouvrir le site sur ce Mac

1. Double-cliquer sur **Démarrer le site.command** dans ce dossier.
2. Ouvrir **http://localhost:8787** dans un navigateur. Garder la fenêtre Terminal ouverte.
3. Lors de la toute première utilisation, cliquer sur **Maylis : activer mon compte admin**. Le profil **Maylis Chancerelle** est préparé ; choisir un identifiant et un mot de passe.
4. Pour arrêter : Ctrl+C dans le Terminal.

Il faut maintenant utiliser l’adresse du serveur, et non ouvrir `index.html` par double-clic. Le serveur peut aussi se lancer avec `npm start` (Node ≥ 22.16 requis ; aucune dépendance serveur à installer).

## Comptes et données personnelles

- Chaque ouverture ou rechargement de la page demande une connexion par identifiant et mot de passe. La navigation interne garde la session active.
- Identifiants et mots de passe respectent les majuscules et minuscules. Les identifiants déjà enregistrés restent tels quels. Pour les comptes créés avant cette évolution, le mot de passe provisoire est l’identifiant au moment de la migration ; il se change dans **Réglages → Mon mot de passe**. Un changement ultérieur d’identifiant ne change pas le mot de passe.
- Le mot de passe est obligatoire mais n’a pas de minimum de longueur ou de règle de complexité. Les mots de passe personnels sont stockés avec sel et dérivation PBKDF2, jamais renvoyés aux autres comptes.
- Un compte coach possède ses propres chronos, exactement comme un athlète. Aucun endpoint ne permet de lire ou de modifier les chronos d’un autre compte.
- Chaque membre s’inscrit librement depuis **Inscription**, sans invitation. Le formulaire propose la case **Je suis coach** : si elle est cochée, le compte peut modifier les contenus du groupe. Ne partagez le lien du site qu’avec l’équipe.
- Un membre ne peut pas s’accorder les droits d’administration : un admin doit le nommer depuis **Réglages**.

## Entraînements

- Planning daté : les journées importées vont du 28 septembre 2026 au 23 janvier 2027. Une journée vide signifie « aucune séance renseignée », pas nécessairement repos.
- La vue initiale sélectionne la date courante. Le calendrier et les boutons de semaine permettent de sélectionner une autre date.
- Les flèches autour de la semaine de séances passent à la semaine précédente ou suivante en conservant le même jour de la semaine. Le calendrier mensuel apparaît avant la frise « La planification en un coup d’œil ».
- Le calendrier peut avancer sans limite, donc jusqu’en août 2028 et au-delà. Aucune séance n’est inventée : les dates sans contenu restent vides et le coach peut y ajouter des séances.
- La frise sous le calendrier retranscrit la première feuille `20262027` pour S1–S27 : périodes générales et d’entraînement, blocs intensité/volume, charge hebdomadaire, vacances scolaires IDF, stage S17, note « Noël + NA » et compétitions indiquées. La ligne « Absences » est présente mais initialement vide, comme dans le classeur. La frise continue, vide par défaut, jusqu’à S105 (fin août 2028), afin que le coach puisse préparer la suite. Les bandes sont continues sur les semaines couvertes. On peut faire défiler la frise horizontalement et toucher une semaine pour ouvrir son lundi. Le mois regroupe les jours par semaine, avec des rappels de charge, intensité, vacances, stage et compétition ; les jours restent cliquables. Les plages de l’Excel sont hebdomadaires, donc aucune date précise de vacances ou de compétition n’est inventée.
- Un coach peut cliquer sur une bande pour modifier son libellé et ses semaines, ou sur une case de charge pour la changer. Le bouton **+ Ajouter un repère** crée période, cycle, bloc intensité/volume, vacances, absence, stage ou note. Ces repères sont communs à l’équipe, synchronisés comme les séances ; les athlètes ne peuvent pas les modifier. Deux éditions concurrentes ne s’écrasent pas silencieusement. Les compétitions ont leur propre éditeur, accessible à tous les membres.
- Les séances restent disponibles sans limite de durée, jusqu’à leur archivage par un coach. Le nettoyage automatique après 90 jours est retiré. Cette mise à jour ne restaure pas les séances déjà supprimées par une ancienne version.
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

## Commentaires de séance

Le bouton **Commenter** ouvre une fenêtre avec une difficulté de 1 à 5 étoiles (très facile à très difficile) et un texte facultatif. Il faut remplir au moins l’un des deux. Chaque membre peut conserver un retour par séance, le modifier ou le supprimer, sur une séance passée ou future. Le retour suit la séance si elle est déplacée.

Les commentaires sont publics au groupe par défaut. **Réservé à moi et aux coachs** rend le texte et la difficulté visibles seulement par l’auteur et les comptes coach. Les comptes admin ne voient pas les retours privés des autres. Le filtrage s’effectue dans l’API avant l’envoi des données au navigateur. La barre de difficulté moyenne utilise exclusivement les votes publics ; un commentaire sans vote n’entre pas dans cette moyenne.

## Compétitions et inscriptions

Tous les profils peuvent ajouter, compléter, déplacer ou retirer une compétition, même ajoutée par quelqu’un d’autre. L’éditeur demande un nom et soit une semaine, soit une date précise. Lieu et niveau restent facultatifs. Plusieurs compétitions peuvent occuper la même semaine. Ces droits ne permettent pas de modifier les séances ou les autres périodes.

Chaque compétition apparaît dans la frise et l’onglet **Compétitions**. Un jour précis ajoute aussi un marqueur au calendrier mensuel ; un événement sans jour précis apparaît dans le rappel de sa semaine. La frise s’étend si des compétitions sont ajoutées avant ou après les semaines initialement prévues.

La case **Inscription** ajoute uniquement le compte connecté, athlète, coach ou admin. La décocher retire son inscription. **Inscrits** montre au groupe les noms et profils ayant coché cette case. Ces inscriptions sont une liste interne au groupe ; elles ne constituent pas une inscription auprès de l’organisateur d’une compétition.

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

Cloudflare Pages héberge le site et Pages Functions ; D1 stocke les séances, comptes, chronos et coordonnées. Le forfait Workers Free inclut actuellement D1 avec jusqu’à 500 Mo par base (5 Go au total), 5 millions de lignes lues et 100 000 lignes écrites par jour. Si une limite journalière est atteinte, les requêtes concernées reprennent à la remise à zéro.

Sur iPhone/iPad, ouvrir le lien dans Safari puis choisir **Partager → Sur l’écran d’accueil**. Sur Android, ouvrir le menu du navigateur puis choisir **Installer l’application** ou **Ajouter à l’écran d’accueil**.

Les fichiers exposés sur le site sont construits dans `dist/`. La base, les sources Excel/Word, le code du serveur local et les autres fichiers du dépôt ne sont pas servis comme fichiers publics.

## Vérifications techniques

`npm test` vérifie le serveur local Node, les comptes, les droits de rôle, les séances et les calculs. Il exerce aussi le vrai gestionnaire Pages sur une base SQLite reproduisant l’ancienne structure D1, avec des comptes et contenus déjà remplis : migration sans perte, conservation des anciennes séances, mots de passe, confidentialité, droits d’édition et inscriptions. Toutes les bases utilisées sont temporaires.

`npm run test:browser` vérifie les parcours dans Chromium avec trois comptes temporaires, les droits admin, les séances multiples, la mise à jour entre onglets, l’annuaire et l’affichage mobile. Installer au préalable les dépendances de développement avec `npm install`, puis le navigateur avec `npx playwright install chromium`. Les captures de vérification sont dans `test-results`.

Le serveur local utilise les modules intégrés de Node : [SQLite](https://nodejs.org/api/sqlite.html) et [crypto](https://nodejs.org/api/crypto.html). La version hébergée utilise les Pages Functions et D1. Un jeton temporaire garde la connexion active dans l’onglet après la saisie du mot de passe.

## Mise à jour d’un site déjà utilisé

Publier le code sur le dépôt existant avec **Push origin** dans GitHub Desktop. Conserver la liaison D1 `DB` du projet Pages actuel : aucune nouvelle base et aucun import manuel ne sont nécessaires. La migration s’exécute automatiquement au premier accès suivant le déploiement.

La migration ajoute `account_credentials`, `session_comments` et `competition_signups`. Elle reprend les compétitions existantes dans des enregistrements dédiés. Les lignes des comptes, leurs chronos, rôles et coordonnées ainsi que les séances et périodes déjà éditées sont conservés. Les importations utilisent des insertions conditionnelles et un repère de migration : un redémarrage ne remet pas les mots de passe à leur valeur provisoire et ne recrée pas une compétition retirée.

Prévenir les membres déjà inscrits que leur première connexion à cette version utilise leur identifiant actuel comme mot de passe provisoire, avec exactement les mêmes majuscules et minuscules. Ils peuvent ensuite le changer dans leurs réglages.
