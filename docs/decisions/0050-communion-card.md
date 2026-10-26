# 0050 — La carte de Sainte-Cène (proposée ; à valider avec le Conseil avant tout code)

Statut : **Proposée.** Seul un **aperçu visuel** existe dans Mon espace (carte verticale, douze mois vides, « Bientôt »). Les faits sur la pratique viennent de Joël
(2026-10-26) et d'un résumé général des EEC : **à confirmer par le Conseil et le pasteur** avant d'être écrits comme des faits publics.

## Ce qui est décidé (réponses de Joël)
- **Qui vise la case** : le groupe d'Église **« Anciens d'Église »**, avec le pasteur. Ils **reçoivent aussi les cotisations et les notent dans un registre**.
  Ce sont donc de vrais rôles dans l'application (visa mensuel + registre des cotisations). L'intégration des paiements viendra plus tard et alimentera le même registre.
- **Baptisé / confirmé** : **les deux** : le membre peut le déclarer dans son profil (consentement `profile` existant, facultatif) **et** le secrétariat ou le pasteur le
  **confirme** d'après le registre des baptêmes avant l'émission d'une carte.
- **Cotisations** : le membre voit **ce qui est attendu** pour sa tranche d'âge et son groupe, **jamais un solde ni un arriéré**. Barèmes réglés en administration
  (rôle trésorier), jamais en dur.
- **Série (streak)** : seuls comptent les mois **avec une Sainte-Cène** ; une absence excusée, notée par les Anciens, **met la série en pause** sans la casser. Ton encourageant.
- Rappel au membre avant la fin de la **semaine de préparation**.

## Esquisse (module `communion`, rien n'est créé)
- `communion_cards` (membre, statut : émise / suspendue / retirée, émise par, date), émission et retrait à **deux personnes** (secrétariat + pasteur).
- `communion_visas` (carte, mois, visé par, date, `excused`), jamais modifiable par le membre ; journal d'audit.
- `fee_schedules` (tranche d'âge ou groupe → montant en XAF) ; `contribution_register` (carte, mois, montant reçu, noté par) **visible des Anciens du quartier et du trésorier seulement**.
- `profiles` : déclaration facultative `baptised`, `confirmed` + `sacrament_confirmed_by/at` (effacées avec le consentement `profile`).
- Rôles : **Ancien d'Église** (limité à son quartier/groupe), secrétariat, pasteur, trésorier. « Quartier » = groupe de type nouveau (`quartier`) à confirmer.
- Notification de membre (nouveau type) pour le rappel ; dates de préparation saisies par le secrétariat.
- Suspension : le membre voit « carte suspendue, voyez le pasteur », **jamais le motif**.
- Vérification (QR signé, copie hors ligne) : plan de la phase 05, point C ; amende 0037.

## Effets juridiques
« Baptisé/confirmé » révèle une appartenance religieuse : donnée sensible (loi n°2024/017). Il faut : consentement explicite distinct, accès limité, ligne dans
`docs/legal/register.md`, mise à jour de la politique de confidentialité, question au juriste (`docs/legal/questions-pour-un-juriste.md`).

## Questions pour la paroisse
1. Quel dimanche est celui de la Sainte-Cène (premier du mois ?) et quelles sont les dates exactes de la **semaine de préparation** ?
2. Comment s'appellent les quartiers/annexes ici, et sont-ils les groupes auxquels les Anciens sont rattachés ?
3. Qui siège parmi les Anciens d'Église, et qui peut noter le registre des cotisations (tous, ou un Ancien trésorier) ?
4. Barème : tranches d'âge et montants, groupes avec cotisation propre ; le visa reste-t-il refusé sans cotisation (règle pastorale que la carte ne doit pas afficher comme une dette) ?
5. Qu'est-ce qu'une absence excusée, qui la note ; transfert vers une autre paroisse (que dit la carte, combien de temps) ?
6. Discipline : que dit-on au membre quand sa carte est suspendue, et qui peut la rétablir ?
7. Combien de temps garder l'historique des visas après le départ d'un membre ? La carte papier continue-t-elle en parallèle ?
