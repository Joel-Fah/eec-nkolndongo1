# 0050 — La carte de Sainte-Cène

Statut : **Acceptée** (Joël, 2026-10-26 : « c'est tout clair »), construite au Checkpoint C ; à relire par le Conseil avec le texte de confidentialité. Les faits sur la pratique viennent de Joël
(2026-10-26) et d'un résumé général des EEC : **à confirmer par le Conseil et le pasteur** avant d'être écrits comme des faits publics.

## Ce qui est décidé (réponses de Joël)
- **Qui vise la case** : le groupe d'Église **« Anciens d'Église »**, avec le pasteur. Ils **reçoivent aussi les cotisations et les notent dans un registre**.
  Ce sont donc de vrais rôles dans l'application (visa mensuel + registre des cotisations). L'intégration des paiements viendra plus tard et alimentera le même registre.
- **Baptisé / confirmé** : **les deux** : le membre peut le déclarer dans son profil (consentement `profile` existant, facultatif) **et** le secrétariat ou le pasteur le
  **confirme** d'après le registre des baptêmes avant l'émission d'une carte.
- **Cotisations** : le membre voit **ce qui est attendu** pour sa tranche d'âge et son groupe, **jamais un solde ni un arriéré**. Barèmes réglés en administration
  (rôle trésorier), jamais en dur.
- **Série (streak)** : seuls comptent les mois **avec une Sainte-Cène** ; une absence excusée, **déclarée par le membre**, **met la série en pause** sans la casser. Ton encourageant.
- Rappel au membre avant la fin de la **semaine de préparation**.

## Esquisse (module `communion`, rien n'est créé)
- `communion_cards` (membre, statut : émise / suspendue / retirée, émise par, date), émission et retrait à **deux personnes** (secrétariat + pasteur).
- `communion_visas` (carte, mois, visé par, date) et `communion_excuses` (carte, mois, déclarée par le membre, sans motif) ; le visa n'est jamais modifiable par le membre ; journal d'audit.
- `fee_schedules` (tranche d'âge ou groupe → montant en XAF) ; `contribution_register` (carte, mois, montant reçu, noté par) **visible des Anciens, du secrétariat et du trésorier (lecture ; écriture : Anciens)**.
- `profiles` : déclaration facultative `baptised`, `confirmed` + `sacrament_confirmed_by/at` (effacées avec le consentement `profile`).
- Rôles : **Ancien d'Église** (le groupe, sans portée par quartier), secrétariat, pasteur, trésorier.
- Notification de membre (nouveau type) pour le rappel ; dates de préparation saisies par le secrétariat.
- Suspension : le membre voit « carte suspendue, voyez le pasteur », **jamais le motif**.
- Vérification (QR signé, copie hors ligne) : plan de la phase 05, point C ; amende 0037.

## Effets juridiques
« Baptisé/confirmé » révèle une appartenance religieuse : donnée sensible (loi n°2024/017). Il faut : consentement explicite distinct, accès limité, ligne dans
`docs/legal/register.md`, mise à jour de la politique de confidentialité, question au juriste (`docs/legal/questions-pour-un-juriste.md`).

## Réponses de la paroisse (2026-10-26)
1. **Dimanche de Sainte-Cène = le deuxième dimanche de chaque mois** (calculé, pas saisi). La **préparation** dure la semaine qui y mène, du lundi ou mardi au samedi ou dimanche :
   par défaut du **lundi au samedi** précédant ce dimanche, ajustable par mois par le secrétariat.
2. **Pas de quartiers ni d'annexes** : ils sortent du modèle (pas de type de groupe `quartier`, pas de portée par quartier sur la carte).
3. **Tous les Anciens peuvent écrire** (visa et registre). Les « équipes de travail par mois » restent une organisation interne, non imposée par l'application ; chaque écriture
   est auditée (qui, quand). Conséquence : les Anciens voient tous les porteurs de carte (strict nécessaire) ; à valider avec le Conseil.
4. **Jamais présenté comme une dette, et le visa n'est jamais refusé pour défaut de paiement** : le registre des cotisations est tenu à part et ne bloque rien. Tranches d'âge et
   montants **entièrement réglés en administration**.
5. **L'excuse est déclarée par le membre** (« excusé » ou non, **sans motif**) ; l'administration ne fait que la **voir**. Elle met la série en pause. *(Cela remplace « noté par les Anciens » plus haut.)*
6. **Suspension/rétablissement : le secrétariat s'en charge** (avec le pasteur pour le retrait), sans motif montré au membre.
7. **Conservation** : l'historique des visas, les excuses et le registre sont gardés **tant que le compte existe** et **effacés avec le compte** (30 jours après la demande de
   suppression, par cascade). *(Claude avait proposé 12 mois de plus après le départ ; ce n'est pas construit : cela demanderait de garder des données sans compte. À décider par le Conseil si
   l'on en veut vraiment.)*
   La **carte papier continue en parallèle** : le numérique l'accompagne et ne la remplace pas tant que le Conseil ne l'a pas décidé ; le visa papier reste la référence.

## Dernières réponses (2026-10-26)
- **Le secrétariat peut voir le registre des cotisations**, comme les Anciens et le trésorier (lecture ; l'écriture reste aux Anciens).
- **Un membre non baptisé n'a simplement pas de carte** : rien n'est affiché à la place (pas de message, pas de carte « en attente »). L'aperçu « Bientôt » ne s'affiche que
  tant que la fonction n'existe pas ; ensuite la carte n'apparaît que pour les porteurs.

Plus aucune question ouverte : le texte peut passer en **Acceptée** quand Joël l'approuve ; la construction se fera au point C.

## Ce qui a été construit (Checkpoint C)
Module `communion` (migration 0039) ; carte en portrait dans Mon espace ; page `/verifier/?t=…` ; scanner et écrans dans l'administration ; rôle système **Ancien d'Église** ; la carte reste sur l'appareil
pour s'ouvrir sans réseau (on garde la coque de la page Mon espace dans le service worker, jamais de données : décision 0037 amendée) ; dépendance ajoutée : `qrcode-generator` 2.0.4 (MIT, côté API, ~20 Ko).
Rappel de préparation : notification de membre `communion_reminder` pendant la semaine de préparation (lundi–samedi avant le deuxième dimanche) tant que le mois n'est ni visé ni excusé.
Non construit : dates de préparation modifiables par mois (les valeurs par défaut s'appliquent), conservation de 12 mois après départ, message pour un membre sans carte (il n'a rien).
