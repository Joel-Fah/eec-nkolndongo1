# Droits des rôles : liste de contrôle (générée)

_Générée par `pnpm --filter @eec/modules grants:report` à partir du code. Ne pas modifier à la main._

**Depuis la décision 0048**, `pnpm db:seed` offre chaque droit de ces rôles **une seule fois** : un droit ajouté au code arrive sur chaque environnement au prochain seed, un droit retiré volontairement dans « Rôles » ne revient pas, un droit ajouté à la main n’est jamais touché. En attendant que 0048 soit en production, ces droits se donnent à la main dans **Rôles**.

## Par rôle

### Super administrateur (`super-admin`)

Accès à tout, y compris aux droits futurs.

Tous les droits, y compris les droits futurs (aucune case à cocher).

### Secrétariat (`secretariat`)

Gère les membres, les contenus courants et la boîte d’envoi.

- `core:users-read` — Voir les utilisateurs
- `core:users-invite` — Inviter des utilisateurs
- `core:users-update` — Modifier les utilisateurs
- `core:users-reset-link` — Générer un lien de réinitialisation **(sensible)**
- `core:groups-read` — Voir les groupes
- `core:system-outbox` — Gérer la boîte d’envoi
- `core:validation-read` — Voir ce qui attend une validation
- `settings:read` — Voir les paramètres
- `settings:edit` — Modifier les coordonnées et la saison
- `news:read` — Voir les actualités (brouillons compris)
- `news:edit` — Écrire et modifier des actualités
- `news:publish` — Publier et programmer des actualités
- `departments:read` — Voir les pages de départements
- `departments:update` — Modifier la page d’un département
- `departments:publish` — Publier la page d’un département
- `contact:read` — Lire les messages reçus
- `contact:handle` — Traiter les messages
- `registrations:read` — Voir les formulaires et les inscrits (numéros compris)
- `registrations:edit` — Créer et modifier un formulaire
- `registrations:manage` — Ajouter, annuler et pointer des inscrits
- `registrations:export` — Exporter la liste des inscrits (CSV) **(sensible)**
- `campaigns:read` — Voir les campagnes et les montants saisis
- `campaigns:edit` — Créer et modifier une campagne
- `campaigns:validate` — Valider les sommes (elles deviennent publiques dans le total) **(sensible)**
- `sundays:read` — Voir les bilans et les tendances
- `sundays:attendance` — Saisir les présences (hommes, femmes, enfants)
- `sundays:close` — Clôturer ou rouvrir un dimanche
- `sundays:export` — Exporter les bilans (CSV) **(sensible)**

### Éditeur (`editeur`)

Écrit et publie les contenus.

- `core:groups-read` — Voir les groupes
- `news:read` — Voir les actualités (brouillons compris)
- `news:edit` — Écrire et modifier des actualités
- `news:publish` — Publier et programmer des actualités
- `sundays:read` — Voir les bilans et les tendances
- `sundays:propose` — Proposer les chiffres du dimanche (à valider par le secrétariat ou la trésorerie)

### Validateur de contenu (`validateur`)

Relit et valide les informations avant qu’elles soient publiques (horaires, adresse, chiffres, textes). Ne publie pas d’actualités et ne change pas les rôles.

- `core:validation-read` — Voir ce qui attend une validation
- `core:validation-comment` — Demander une correction ou laisser une remarque
- `core:groups-read` — Voir les groupes
- `settings:read` — Voir les paramètres
- `settings:validate` — Valider une information pour le public **(sensible)**
- `schedule:read` — Voir les horaires
- `schedule:validate` — Approuver les horaires
- `liturgy:read` — Voir la liturgie
- `story:read` — Voir les textes des pages
- `story:publish` — Publier les textes des pages et l’histoire
- `news:read` — Voir les actualités (brouillons compris)
- `events:read` — Voir l’agenda (brouillons compris)
- `guides:read` — Voir les parcours
- `departments:read` — Voir les pages de départements

### Pasteur (`pasteur`)

Un pasteur ou une pasteure. Sans droit d’administration : sert à proposer les noms pour la prédication.

- `sundays:read` — Voir les bilans et les tendances

### Responsable de groupe (`responsable-groupe`)

Gère un groupe précis (à attribuer avec le groupe).

- `core:groups-read` — Voir les groupes
- `news:read` — Voir les actualités (brouillons compris)
- `news:edit` — Écrire et modifier des actualités
- `departments:read` — Voir les pages de départements
- `departments:update` — Modifier la page d’un département
- `sundays:read` — Voir les bilans et les tendances
- `registrations:read` — Voir les formulaires et les inscrits (numéros compris)
- `registrations:edit` — Créer et modifier un formulaire
- `registrations:manage` — Ajouter, annuler et pointer des inscrits

### Trésorier (`tresorier`)

Suit les dons et les finances.

- `campaigns:read` — Voir les campagnes et les montants saisis
- `campaigns:progress` — Saisir les sommes reçues
- `sundays:read` — Voir les bilans et les tendances
- `sundays:offerings` — Saisir les offrandes

### Membre (`membre`)

Fidèle inscrit : accès à son espace personnel.

Aucun droit d’administration (compte de membre).

## Droits qu’aucun rôle système ne porte

Seul le super administrateur les a. **Question pour Joël : lequel de ces droits doit être donné à quel rôle ?** (Un droit « sensible » est audité et se donne avec prudence.)

- `core:users-deactivate` — Désactiver des comptes **(sensible)**
- `core:roles-read` — Voir les rôles
- `core:roles-manage` — Créer et modifier les rôles et leurs droits **(sensible)**
- `core:roles-assign` — Attribuer des rôles aux utilisateurs **(sensible)**
- `core:groups-manage` — Créer et modifier les groupes
- `core:audit-read` — Lire le journal d’activité
- `core:audit-export` — Exporter le journal d’activité **(sensible)**
- `core:system-health` — Voir la santé du site
- `core:visits-read` — Voir les visites du site
- `core:system-design` — Voir le guide de design
- `settings:flags` — Activer ou désactiver des fonctionnalités **(sensible)**
- `media:read` — Voir la médiathèque
- `media:upload` — Ajouter des fichiers
- `media:edit` — Modifier les descriptions et crédits
- `media:delete` — Supprimer des fichiers **(sensible)**
- `members:read` — Voir les membres et les chiffres
- `members:export` — Exporter la liste des membres **(sensible)**
- `news:delete` — Supprimer des actualités **(sensible)**
- `sermons:read` — Voir les prédications (brouillons compris)
- `sermons:edit` — Écrire et modifier des prédications
- `sermons:publish` — Publier et programmer des prédications
- `sermons:delete` — Supprimer des prédications **(sensible)**
- `meditations:read` — Voir le programme de méditation
- `meditations:edit` — Modifier le programme et importer un calendrier
- `meditations:publish` — Publier un programme
- `meditations:delete` — Supprimer un programme **(sensible)**
- `bulletin:read` — Voir les bulletins (brouillons compris)
- `bulletin:edit` — Composer et modifier le bulletin
- `bulletin:publish` — Publier le bulletin
- `bulletin:delete` — Supprimer un bulletin **(sensible)**
- `registrations:delete` — Supprimer un formulaire ou une inscription **(sensible)**
- `campaigns:delete` — Supprimer une campagne **(sensible)**
- `events:edit` — Créer et modifier des événements
- `events:publish` — Publier, programmer et annuler des événements
- `events:delete` — Supprimer des événements **(sensible)**
- `schedule:update` — Modifier les horaires
- `liturgy:edit` — Préparer les dimanches et les versets
- `liturgy:publish` — Publier les dimanches
- `liturgy:validate` — Approuver les textes de l’année liturgique
- `departments:quiz` — Modifier le questionnaire « Où est ta place ? »
- `guides:edit` — Modifier les parcours
- `guides:publish` — Publier un parcours
- `guides:delete` — Supprimer un parcours **(sensible)**
- `story:edit` — Modifier les textes des pages et l’histoire
- `story:council` — Gérer Pasteurs et Conseil
- `contact:read-sensitive` — Lire les demandes de prière **(sensible)**
- `contact:delete` — Supprimer un message **(sensible)**
- `legal:read` — Voir les documents légaux
- `legal:update` — Rédiger les documents légaux
- `legal:publish` — Publier une version d’un document légal **(sensible)**
