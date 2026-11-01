# Mon espace — le chez-soi du membre (plan d'information)

_Phase 05, Checkpoint A. Écrit **avant** de construire. Décision 0047 : « Mon espace » doit être planifié comme un seul produit, pas empilé fonction par fonction._

## 1. Pour qui, et à quel moment
- Un·e paroissien·ne sur un téléphone Android de milieu de gamme, avec des données mobiles payantes, une main sur le téléphone (souvent le dimanche matin, parfois depuis la diaspora).
- Ils ouvrent « Mon espace » pour **trois choses** : **ce qui se passe pour moi cette semaine**, **mes groupes**, et (plus tard) **ma carte de Sainte-Cène**.
- Tout ce qui est administratif (profil, accords, copie des données, suppression, appareils) existe, mais **un pas plus loin**.

## 2. Navigation interne (5 sections au maximum)
Une barre de sections collée en haut (défilable sur 360 px, icône + libellé, pas de menu caché). Une section à la fois, adressable par son ancre (`#accueil`, `#inscriptions`, `#groupes`, `#notifications`, `#profil`), chargée à la demande.

| Section | Contenu | Pourquoi |
|---|---|---|
| **Accueil** (ma semaine) | Bonjour ; **Ce dimanche** (liturgie + horaires validés) ; **mes prochaines inscriptions** (date, statut, ajouter à mon calendrier) ; les prochains événements de **mes groupes** ; la complétion du profil (si incomplète) ; la tuile **Carte de Sainte-Cène — bientôt** | La première chose qu'on veut voir |
| **Mes inscriptions** | À venir et passées, avec le statut (confirmée / liste d'attente et sa position), annuler, ajouter au calendrier, **relier** une inscription faite sans compte | Plus de papier ni de capture d'écran du code |
| **Mes groupes** | Les groupes dont je fais partie (nom, lien vers la page du groupe), quitter un groupe ; (Checkpoint B : demander à rejoindre, annonces) | Le sentiment d'appartenance |
| **Notifications** | Liste dans le site, regroupée par semaine, avec liens directs ; réglage par type (0046) | Ce qui m'attend, sans e-mail ni SMS |
| **Profil et confidentialité** | Photo et avatar, détails facultatifs, accords, copie de mes données, suppression, appareils connectés, déconnexion (le contenu actuel, **réorganisé, pas réécrit**) | Contrôle de mes données |

## 3. Première écran vs un pas plus loin
- **Écran 1 (Accueil)** : ≤ 4 cartes, la plus utile en premier (ma prochaine inscription, ou Ce dimanche s'il n'y en a pas).
- **Un pas plus loin** : tout le reste. Aucun tableau dense ; cartes de ≥ 44 px, un pouce suffit à 360 px.
- Le bouton de l'en-tête du site (avatar) mène à l'Accueil ; la **cloche** de l'en-tête mène à Notifications.

## 4. États vides et incomplets (avec illustration Storyset, ton chaleureux)
- Aucune inscription : « Rien de prévu pour l'instant » + lien vers l'agenda.
- Aucun groupe : « Vous n'êtes dans aucun groupe » + lien vers les départements.
- Aucune notification : « Tout est calme ».
- Profil incomplet : la carte de complétion actuelle (jamais bloquante), et la marque d'alerte sur l'avatar.
- Hors ligne : la page demande le réseau (privé, jamais mis en cache — décision 0037) ; seule la carte de Sainte-Cène aura une règle explicite au Checkpoint C.

## 5. Poids et technique
- Aujourd'hui : un seul îlot (`AccountView.astro`, 971 lignes ; script ≈ 5 Ko gz). **Objectif** : îlot de base ≤ 8 Ko gz, chaque section chargée à la demande (≈ 2 Ko gz chacune), tout reste privé, `no-store`, hors du cache du service worker (le préfixe `mon-espace` est déjà privé).
- Une seule petite bibliothèque d'appels (`api`, `put`, formatage de dates) partagée, au lieu des deux copies actuelles (`call()` dans AccountView, `api()` dans `profile.ts`).

## 6. Décisions que ce plan impose (avec la recommandation retenue pour avancer)
1. **Relier des inscriptions faites sans compte.** On ne peut ni envoyer un code (pas d'e-mail ni de SMS), ni faire confiance à un téléphone ou une adresse tapés (identité non vérifiée : on pourrait « réclamer » l'inscription de quelqu'un d'autre).
   **Retenu :** (a) une inscription faite **connecté·e** est liée automatiquement ; (b) une inscription faite sans compte se **relie en ouvrant son lien d'annulation signé** (la possession du lien prouve que c'est la vôtre) ; (c) à défaut, le secrétariat peut la relier. **Pas de correspondance automatique** par téléphone ou e-mail.
2. **Les inscriptions passées** disparaissent avec la rétention (6 à 12 mois : décision 0035) ; le membre le voit écrit.
3. **Notifications des membres** : mêmes tables que l'équipe (0044/0046), un point d'accès plus léger, nouveaux types (liste d'attente promue, changement de politique, plus tard annonces de groupe). Les mises en sourdine par type s'étendent.
4. **Inscription au compte avec les groupes** : le champ `groupKeys` existe dans l'API mais l'interface ne l'envoie pas. Retenu : ne pas le brancher ici ; « demander à rejoindre » arrive au Checkpoint B (décision 0049).
5. **Carte de Sainte-Cène** : tuile « bientôt » seulement, tant que la paroisse n'a pas défini ce qu'elle atteste (Checkpoint C).
6. **Données personnelles** : A n'ajoute aucune nouvelle donnée ; il montre au membre ce que le site a déjà (ses inscriptions, ses groupes). Le volet légal (Checkpoint L) est reporté à la demande de Joël ; la **lecture la plus prudente** s'applique : accès minimal, accord explicite, rien de sensible en plus.

## 7. Mise en page revue (Joël, 2026-10-26)

- **Connecté = pleine largeur.** L'introduction et la carte d'inscription (colonne étroite) s'effacent ; Mon espace occupe toute la largeur (80 rem max).
- **Ordinateur (≥ 64 rem)** : navigation verticale collante à gauche (5 entrées, pastille de notifications), contenu à droite en grille de cartes qui s'adapte (colonnes de 19 rem mini). Les notifications restent en une colonne de lecture.
- **Téléphone** : barre collante des 5 sections toujours visibles (icône au-dessus d'un court libellé), plus de défilement horizontal caché.
- **Chargement** : la première section s'affiche seule, puis les autres se chargent au repos du navigateur (`requestIdleCallback`) et restent en mémoire de la page ; changer d'onglet est instantané. Les notifications se rafraîchissent à l'ouverture si les données ont plus de 30 s. Toujours `private, no-store`, jamais en cache du service worker ; le JS reste en imports dynamiques (aucune section chargée avant l'ouverture de la page).

## 8. Groupes et carte de Sainte-Cène (Checkpoints B et C, construits en dev)
- **Mes groupes** : mes groupes avec leurs annonces récentes et leur prochain événement, la case « partager mon numéro » (décochée), mes demandes en attente (retirables), les groupes que je peux demander à rejoindre (réponse et message du responsable visibles). Une page publique de groupe me dit, à moi seul, « Vous êtes membre de ce groupe ».
- **Accueil** : la carte de Sainte-Cène n'apparaît **que** pour qui en détient une (colonne de droite du bento) ; sans carte, rien n'est affiché. Hors réseau, la dernière carte vue s'ouvre depuis l'appareil (« vérifiée le … »).
- **Notifications** : `group_announcement`, `group_decision` (réponse à ma demande), `communion_reminder` (semaine de préparation), chacun coupable.
- **Profil** : « Baptême et confirmation » (facultatif, sous le profil complet).
- **Administration** : « Mon groupe », « Annonces de groupe », « Cartes de Sainte-Cène » (cartes, nouvelle carte, cotisations attendues, vérifier une carte).

## Team members
A person with a role in the team sees one extra card on Accueil, « Votre espace d'équipe », with a button to the admin (the address comes from `/api/me/profile`, `admin`, never built into the page; members get `null`). A team member who still has to choose a password (decision 0053) sees it first, with the reason, and the admin then takes them to the password step.
