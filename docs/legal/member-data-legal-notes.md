# Notes juridiques sur les données des membres (Loi n°2024/017)

> **État : lecture de sources secondaires. Le texte officiel n'a pas pu être récupéré en entier.** Le Journal officiel et le texte du décret d'application n'étaient pas accessibles par recherche ; les résumés de cabinets et de sites juridiques trouvés **divergent sur certains points**. Rien n'est inventé ici : chaque point est marqué *certain* (concordance de plusieurs sources) ou *à confirmer* (un juriste doit lire le texte). **Aucun de ces points ne remplace l'avis d'un juriste camerounais.**

## Ce que disent les sources

| Sujet | Ce que les sources rapportent | Niveau |
|---|---|---|
| La loi | Loi n°2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel : première loi camerounaise dédiée. Elle s'applique à tout traitement par l'État, les collectivités, ou toute personne physique ou morale sur le territoire. | certain |
| Consentement | Article 9 (selon un résumé) : libre, éclairé, spécifique, univoque et exprès, **avant** le traitement ; pour un mineur de moins de 18 ans, consentement parental. | certain (numéro d'article à confirmer) |
| Données sensibles | Article 5 (selon un résumé) : les « opinions et activités religieuses, philosophiques, politiques ou syndicales » sont sensibles ; leur traitement est **en principe interdit**. | certain pour le principe ; **les exceptions applicables à une association religieuse : à confirmer** |
| Exception pour les organismes religieux | Aucune source consultée ne la mentionne ni ne l'exclut. | **à confirmer par un juriste** |
| Autorité | Autorité de protection des données personnelles (APDP). Plusieurs sources notent que son décret d'organisation n'est pas publié : elle ne serait pas encore opérationnelle. | à confirmer |
| Déclaration / autorisation | Article 19 (selon un résumé) : traitement soumis à **autorisation préalable** de l'autorité. Un projet de décret distingue avis préalable, déclaration préalable et autorisation préalable. | **divergent, à confirmer** |
| Registre des traitements | Article 29 ou 39 selon les sources : le responsable tient un registre des opérations de traitement. | certain (article à confirmer) → `docs/legal/register.md` |
| Délégué à la protection des données | Une source : obligatoire pour les traitements à grande échelle ; une autre : absent du texte final. | **divergent, à confirmer** |
| Transferts à l'étranger | Article 32 (selon un résumé) : soumis à autorisation préalable de l'autorité, avec contrôle d'un niveau de protection équivalent. | certain pour le principe |
| Droits des personnes | Accès, rectification, opposition, effacement. **Aucun délai de réponse n'est donné par les sources consultées.** | droits certains ; **délai inconnu** |
| Violation de données | À signaler à l'autorité « sans délai » (articles 22 et 27 selon un résumé) et, selon la gravité, aux personnes. Le délai de 72 h figurait dans un projet. | à confirmer |
| Période transitoire | 18 mois à partir de la promulgation (article 73) : mise en conformité au **23 juin 2026**. | certain (date calculée par plusieurs sources) |
| Sanctions | Administratives, civiles et pénales (amendes, emprisonnement). | certain |

## Conséquences sur ce que nous faisons (lecture prudente appliquée jusqu'aux réponses)
1. **Baptême, confirmation, carte de Sainte-Cène = donnée sensible.** Nous exigeons un accord explicite et éclairé (fenêtre d'explication + case à cocher, côté serveur aussi), un accès réservé aux personnes qui émettent les cartes, l'effacement avec le compte, et rien de public (décision 0050).
2. **Groupes d'Église** : l'appartenance à un groupe peut révéler une croyance ; demande puis acceptation, numéro partagé seulement si la personne le choisit, rien de public (décision 0049).
3. **Registre des traitements** : tenu (`docs/legal/register.md`).
4. **Droits** : les membres ont leurs outils (copie, suppression) ; les autres passent par le registre des demandes (décision 0052). **Délai de 30 jours = lecture prudente, à confirmer.**
5. **Transferts à l'étranger** : hébergement Neon (Francfort, à confirmer dans la console Neon) et Cloudflare : à poser au juriste (autorisation préalable ?).
6. **Mineurs** : aucune collecte ciblée ; une inscription pour des enfants passe par le parent ou tuteur.

## Sources consultées (secondaires)
[La Base Lextenso](https://www.labase-lextenso.fr/lessentiel-droits-africains-des-affaires/DAA202v2) · [CIO Mag](https://cio-mag.com/la-protection-des-donnees-a-caractere-personnel-au-cameroun-a-la-lecture-de-la-loi-du-23-decembre-2024/) · [OBS-CC](https://obs-cc.org/gouvernance/protection-donnees-personelles/) · [Anove](https://www.anove.ai/fr/regulations/cameroon-law-2024-017) · [DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=CM) · [Maathis (texte partiel)](https://app.maathis.com/droit/cameroun/loi/2024-017-loi-n-2024017-23-dec-2024-relative-protection-donnees-caractere-personn) · [Africa Data Protection](https://www.africadataprotection.org/en/pays/cameroun.html).

**À faire :** obtenir le texte officiel (Journal officiel / Présidence) et le décret d'application, puis remplacer chaque ligne « à confirmer » par une citation d'article.
