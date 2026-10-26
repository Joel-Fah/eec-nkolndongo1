# 0052 — Le registre des demandes sur les données
**Status:** Accepted · 2026-10-26 (Joël)
**Context:** Un membre peut déjà voir et effacer ses données depuis Mon espace. Une personne **sans compte**, ou qui demande par téléphone, en personne ou par écrit, n'a aujourd'hui aucune trace : on ne saurait pas montrer qu'on a répondu à temps.
**Decision:**
1. **Un petit registre dans l'administration** (module `rights`) : type (accès, rectification, effacement, opposition, autre), nom de la personne, moyen de lui répondre (facultatif), comment la demande est arrivée, date de réception, **date limite**, état (reçue, en cours, traitée, refusée), ce qui a été fait (quelques mots, **jamais les données**), date de clôture.
2. **Délai** : 30 jours à partir de la réception, la lecture prudente. **À confirmer** avec le texte de la loi n°2024/017 (notes juridiques, Checkpoint L, reporté).
3. **Rappels** : une notification de personnel (« à traiter ») pour ceux qui peuvent lire le registre quand une demande est en retard ou arrive à échéance sous 5 jours.
4. **Accès** : `rights:read`, `rights:handle` (secrétariat), `rights:delete` (dangereux, super administrateur seulement). Le journal d'activité dit qu'une demande a été notée ou changée et de quel type, jamais qui.
5. **Conservation** : une demande close est effacée 24 mois après sa clôture (durée à confirmer avec les notes juridiques).
**Consequences:** migration 0040 (additive) ; guide d'aide « Répondre à une demande sur les données » ; entrée dans `docs/legal/data-protection.md` et le registre des traitements.
