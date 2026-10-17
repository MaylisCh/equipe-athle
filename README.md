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
- Un compte coach possède ses propres références d’allure, exactement comme un athlète. Les références personnelles ne sont pas partagées. Les chronos de séance, distincts de ces références, sont visibles par leur auteur et les coachs ; chacun ne peut modifier que ses propres saisies.
- L’inscription depuis **Inscription** demande le code du groupe. La case **Je suis coach** demande aussi le code coach ; ces codes respectent les majuscules et minuscules. Les valeurs initiales sont `NOUVEAU` et `COACH`.
- Un membre athlète peut demander le rôle coach depuis **Réglages**, avec le code coach. Les admins voient les deux codes en clair dans leurs réglages et peuvent les remplacer. Les codes sont communs à tous les admins ; chaque changement invalide immédiatement l’ancienne valeur.
- L’activation initiale du compte admin reste distincte de l’inscription au groupe. Un admin peut toujours attribuer ou retirer le rôle coach d’un autre membre depuis **Gestion des membres**.
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

Les commentaires sont publics au groupe par défaut. **Réservé à moi et aux coachs** rend le texte et la difficulté visibles seulement par l’auteur et les comptes coach. Les admins non-coachs ne voient pas les retours privés des autres ; ceux ayant activé les fonctions coach les voient comme les coachs. Le filtrage s’effectue dans l’API avant l’envoi des données au navigateur. La barre de difficulté moyenne utilise exclusivement les votes publics ; un commentaire sans vote n’entre pas dans cette moyenne.

## Compétitions et inscriptions

Tous les profils peuvent ajouter, compléter, déplacer ou retirer une compétition, même ajoutée par quelqu’un d’autre. L’éditeur demande un nom et soit une semaine, soit une date précise. Lieu et niveau restent facultatifs. Plusieurs compétitions peuvent occuper la même semaine. Ces droits ne permettent pas de modifier les séances ou les autres périodes.

Chaque compétition apparaît dans la frise et l’onglet **Compétitions**. Un jour précis ajoute aussi un marqueur au calendrier mensuel ; un événement sans jour précis apparaît dans le rappel de sa semaine. La frise s’étend si des compétitions sont ajoutées avant ou après les semaines initialement prévues.

La case **Inscription** ajoute uniquement le compte connecté, athlète, coach ou admin. La décocher retire son inscription. **Inscrits** montre au groupe les noms et profils ayant coché cette case. Ces inscriptions sont une liste interne au groupe ; elles ne constituent pas une inscription auprès de l’organisateur d’une compétition.

## Fichiers Excel des séances de musculation

Dans la fiche d’une séance de **Musculation**, le coach utilise **+ Fichier Excel**. Jusqu’à **5 fichiers .xlsx ou .xls par séance**, chacun de **100 Ko maximum** (102 400 octets). Cette limite est appliquée dans le navigateur et l’API. Les pièces jointes sont représentées par une icône Excel et leur nom à l’emplacement de l’ancien bouton de chronos ; les séances de musculation sont retirées du carnet de chronos et les nouvelles saisies de chronos y sont refusées. Les éventuels anciens résultats restent en base, sans suppression automatique.

Cliquer une icône ouvre un **aperçu en lecture seule** dans une fenêtre indépendante : il reste ouvert en changeant d’onglet du site. Fermer par la croix, Échap ou un clic à l’extérieur ; la navigation principale reste utilisable sans fermer le document. Sur mobile, le menu de navigation reste accessible. Le bouton **Télécharger** restitue exactement l’original. La déconnexion ferme la fenêtre et libère le fichier en mémoire.

L’aperçu .xlsx conserve les tableaux, fusions de cellules, couleurs, bordures, retours à la ligne et feuilles. Les formules ne sont pas exécutées : il utilise les valeurs enregistrées dans le fichier. Ce n’est pas un moteur Excel complet : graphiques, images et mises en page complexes peuvent ne pas être reproduits ; l’original reste disponible. Limites d’aperçu : 20 feuilles, 300 lignes et 50 colonnes par feuille, avec avertissement si la zone est tronquée. Les anciens .xls sont téléchargeables, sans aperçu intégré. Aucune copie n’est envoyée à un service de lecture externe. Le classeur entier est partagé avec le groupe : ne pas y inclure d’informations privées, même dans une feuille masquée.

Les coachs et admins avec fonctions coach peuvent ajouter, remplacer et retirer les fichiers. Les athlètes et admins non-coachs peuvent uniquement les consulter/télécharger. L’accès exige une connexion ; il n’existe pas de lien public direct ni de cache de l’API. Un fichier est lié à l’id de séance et suit ses déplacements ; supprimer le compte du coach ne supprime pas le document partagé. L’archivage d’une séance masque ses pièces jointes du planning actif sans les effacer.

Stockage dans la base D1 existante, sans nouvelle liaison Cloudflare : table additive `session_attachments`, octets originaux encodés en base64. `/api/state` renvoie seulement les métadonnées, pas le contenu. Le fichier n’est chargé qu’à son ouverture. La taille choisie reste très inférieure à la [limite D1 par ligne/valeur](https://developers.cloudflare.com/d1/platform/limits/). Aucun Word/Excel source n’est modifié. Les fichiers importés comme pièces jointes ne remplacent aucune séance et ne passent pas par l’outil d’import de planning.

## Recherche des membres

**Réglages → Gestion des membres** comprend une recherche par prénom, nom ou identifiant et un compteur des comptes trouvés. **Le groupe** conserve sa recherche par prénom/nom. Les deux ignorent accents, casse, ligatures (`œ`/`oe`, `æ`/`ae`), apostrophes et traits d’union ; les mots peuvent être saisis dans un autre ordre. Par exemple `elodie coeur hotel` retrouve `Élodie Cœur-D’Hôtel`. Cela ne modifie pas les règles de casse des identifiants de connexion.

## Bibliothèque et infos du groupe

Le coach peut ajouter, modifier ou archiver les acronymes, circuits et informations. Les paragraphes fournis en début d’année sont conservés, regroupés sous « Organisation & pratique » et « Relations & règles du groupe ». Ils ne sont accessibles qu’après connexion.

Les modifications sont enregistrées dans la base commune et récupérées automatiquement par les autres sessions ouvertes chaque minute et au retour dans l’onglet. Les formulaires en cours de saisie ne sont pas remplacés. Si deux coachs modifient le même élément, la seconde sauvegarde reçoit un avertissement de conflit plutôt que d’écraser la première.

## Navigation et annuaire

Après connexion, le site affiche toujours le planning. Les boutons de navigation sont dans la barre latérale sur ordinateur ; sur téléphone, le bouton « Menu » ouvre la liste des pages.

**Réglages → Rôle dans le groupe** propose maintenant la case **Je suis coach** à tous les comptes. Un athlète doit saisir le code coach. Un admin peut activer/désactiver ses fonctions coach sans code supplémentaire et sans perdre son rôle ni ses droits admin, même s’il est le dernier admin.

Un **admin** gère les comptes et les rôles ; s’il active les fonctions coach, il peut aussi éditer les contenus et consulter les retours/résultats du groupe comme un coach. Sans cette option, ses droits restent ceux d’un admin non-coach. Chaque profil a ses propres chronos.

## Allures et Chrono Séance

L’ancien onglet **Mes chronos** s’appelle **Allures** (l’adresse interne `#chronos` reste compatible). Il conserve le calculateur et les chronos de référence personnels.

L’onglet **Chrono Séance** affiche directement les séances dans une frise hebdomadaire colorée. Le formulaire du haut est supprimé : cliquer une carte ouvre la saisie personnelle, avec l’exemple `25.8 / 48.2 / 24.4 / 25` et un aperçu numéroté. Les nouveaux chronos sont séparés uniquement par un tiret ou un slash ; point/virgule restent acceptés pour les décimales et les minutes sont toujours possibles. De 1 à 200 chronos positifs sont acceptés, jusqu’à 4000 caractères. Les anciennes saisies sont conservées ; lors d’une correction, elles sont présentées dans le format à slashs sans changer leurs valeurs.

La frise montre les jours/dates, les titres des séances, les créneaux seulement s’ils sont renseignés et un indicateur de résultats. Navigation par semaine, par mois, directement à une date, vers aujourd’hui ou vers un jour renseigné précédent/suivant. Les sauts de mois conservent le numéro du jour, borné à la fin du mois si nécessaire. Sous la frise : détail de la séance sélectionnée et résultats ; **Historique complet** est repliable. Les liens avec le planning sont conservés.

Les athlètes et admins non-coachs ne reçoivent que leurs propres résultats. Les coachs et admins ayant activé les fonctions coach voient les chronos des membres dans un tableau, également présent dans la fenêtre de saisie, sans pouvoir les modifier pour eux. La saisie reste personnelle pour tous. On peut ajouter, modifier ou supprimer ses chronos depuis la carte correspondante. L’actualisation de l’état ne remplace pas une fenêtre de saisie ouverte.

Les séances sans créneau ne présentent plus « Créneau à préciser », ni badge vide, dans le planning, le carnet ou les listes de séances à échanger. L’éditeur conserve un choix **Sans créneau** ; matin/après-midi/soir restent affichés lorsqu’ils sont choisis. La valeur technique `non-precise` et les données existantes ne changent pas.

Ces chronos sont stockés séparément des références d’Allures, par identifiant de séance et identifiant de membre. Ils suivent une séance déplacée ; les chronos déjà saisis restent consultables et corrigeables si le coach l’archive. Une date sans séance ne permet pas d’inventer une entrée indépendante du planning. Supprimer un compte efface aussi ses résultats personnels, pas les séances partagées.

Dans la fenêtre de saisie, **Distances (facultatif)** permet d’associer une distance en mètres à chaque chrono, ou de laisser certains champs vides. Le champ **Même distance pour toutes** évite de répéter la saisie. Les récapitulatifs personnels, coach et l’aperçu affichent ensemble la distance et son chrono, par exemple `200 m · 25,80 s` ; sans distance, le chrono seul reste affiché. Les distances restent attachées à leur répétition dans l’ordre des chronos et sont modifiables. Elles ne modifient ni les consignes du coach ni les références d’Allures.

La séance et sa V2 sont affichées directement dans le détail et la fenêtre de saisie, sans volet à déplier et sans échauffement dans cet onglet. Le lien **Voir au planning** reste visible ; l’échauffement est conservé au planning. La flèche circulaire **↻** ramène à **aujourd’hui**, indépendamment de la connexion réseau. Le bouton **Actualiser** est séparé et conserve la date sélectionnée.

La nouvelle table additive `session_result_distances` conserve les distances par séance/membre, dans un tableau aligné sur les chronos. Les anciens résultats restent intacts et sont présentés avec des distances vides. Chronos et distances sont enregistrés dans la même transaction avec contrôle de version ; la suppression d’un résultat ou d’un compte supprime aussi ses distances. Les droits de visibilité et d’édition restent identiques à ceux des chronos. Un ancien client ne peut pas supprimer silencieusement des distances en changeant le nombre de répétitions.

Migration additive : nouvelles tables `session_results` et `admin_coach_access`, aucune remise à zéro des comptes ou contenus. Les droits coach sont évalués côté serveur pour les contenus, imports, retours privés et résultats. `npm run test:results-browser` vérifie le nouveau parcours ; `npm test` inclut `session-results-test.mjs`.

Dans **Réglages → Codes d’accès au groupe**, tous les admins voient les deux codes partagés et peuvent les remplacer ; chaque modification invalide immédiatement l’ancienne valeur pour les prochaines inscriptions et demandes coach. Les valeurs de départ sont `NOUVEAU` et `COACH`. Les codes sont sensibles à la casse et seuls les admins les reçoivent de l’API.

Dans **Réglages → Gestion des membres**, un admin peut nommer un membre admin ou coach, retirer ces droits, réinitialiser le mot de passe d’un autre membre ou supprimer son compte. La nomination directe d’un coach par un admin reste disponible. La réinitialisation demande de saisir un nouveau mot de passe provisoire, sans règle de complexité, ferme toutes les connexions du membre et ne modifie pas ses chronos. Le membre peut ensuite changer ce mot de passe dans ses réglages. Les athlètes et coachs n’ont aucun de ces droits sur les autres comptes ; les contrôles sont aussi appliqués côté serveur. On ne peut jamais retirer ou supprimer le dernier admin. Les changements de rôles sont journalisés. Un membre qui perd ses droits admin retrouve son rôle précédent (coach ou athlète).

**Le groupe** affiche un tableau des membres (prénom, nom, téléphone, rôle, date d’ajout), avec recherche. Les dates d’ajout sont enregistrées pour les nouveaux comptes ; les dates anciennes inconnues restent « Non renseignée ». Seuls les comptes connectés y accèdent. Aucun chrono des autres membres n’y est transmis ; seuls les admins reçoivent les identifiants nécessaires à la gestion des comptes. Le téléphone est facultatif.

La suppression de son propre profil ou d’un autre compte par un admin demande une case de confirmation « Êtes-vous sûr de vouloir supprimer ce compte ? ». Elle efface le compte, ses coordonnées, ses chronos, ses commentaires et ses inscriptions, mais conserve les séances, compétitions et informations partagées. Le dernier admin doit d’abord nommer un successeur. Cette mise à jour ne supprime ni ne réinitialise aucun compte existant automatiquement.

## Documents source

Les Word et Excel du dossier parent sont exclusivement lus. Aucun traitement n’écrit dedans.

- `Saison hivernale 2026 2027.xlsx` fournit les séances détaillées depuis ses onglets Cycle. Les dates sont rattachées à la saison 2026–2027, même si l’onglet annuel de ce fichier porte par erreur le nom `20252026`. La feuille `20262027` de la copie `Vathlète` sert de référence pour l’année de la planification ; ses onglets Cycle moins détaillés ne remplacent pas les séances du classeur principal.
- Les cellules « Repos » ne créent pas de séance : le jour reste vide. Les semaines incomplètes restent incomplètes.
- Les coachs disposent d’un onglet **Importer les séances** pour déposer, choisir ou coller un `.xlsx` ou `.csv`. Le lecteur reconnaît les tableaux avec une date par ligne et les grilles de semaine avec les jours en lignes ou en colonnes. Il montre chaque date, séance, remplacement et repos dans un aperçu avant d’exiger la case **Je confirme l’importation**.
- L’import ne touche jamais aux séances de la semaine en cours ou des semaines précédentes. Les dates anciennes d’un fichier mixte sont simplement ignorées et comptées dans l’aperçu. Pour les dates futures présentes dans le tableau, une cellule vide ou « Repos » efface les séances du jour ; une nouvelle séance remplace toutes celles de ce jour. La séparation échauffement/séance reprend les indices déjà utilisés dans les classeurs saisonniers : colonne échauffement, mention explicite « à l’échauffement », ou ligne initiale de renforcement/gammes identifiable ; sinon, le champ échauffement reste vide. Les conditions du type « Vitesse/technique si stage » gardent l’activité comme titre et placent « Si stage » en sous-titre ; le type est déduit du titre d’activité, sans limiter les titres acceptés à une liste fermée. Le sous-titre reste visible dans le planning et modifiable par le coach.
- Le Word d’une semaine antérieure fournit uniquement les définitions et circuits. Ses séances ne sont pas mélangées au calendrier des cycles.
- `Muscu 2309.xlsx` n’est pas affecté arbitrairement à la séance de force excentrique d’un autre cycle.
- Une note coach signale que la consigne du 1er octobre indique `(800)`, alors que `2×250 + 2×200` totalise 900 m. Le texte original est conservé, sans correction du document.

`import_sources.py` régénère le fichier de préparation `seed.json` à partir du classeur en lecture seule. La migration détaillée unique ne met à jour que les séances à partir de la semaine suivant son exécution. Les séances passées et celles de la semaine en cours sont conservées ; les séances déjà modifiées par un coach sont également conservées. Les anciens repos futurs sont archivés, sans suppression de données.

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
