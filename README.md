# EEC Nkolndongo 1 — Site web de la paroisse

Site web officiel et outil d'administration de la **Paroisse EEC Nkolndongo 1**
(Église Évangélique du Cameroun, Yaoundé).

- **Site public** — découvrir la paroisse, suivre l'actualité, l'agenda et l'année liturgique, s'inscrire, donner.
- **Espace membres** — compte fidèle (recensement, futurs services : carte de Sainte-Cène…).
- **Administration** — tableau de bord à accès restreint, rôles et permissions configurables.

Français d'abord · English · Thème clair / sombre · Léger en données mobiles.

> Statut : **phase de cadrage** — aucune application n'est encore construite. Voir [STATUS.md](STATUS.md).

## Où lire quoi

| Fichier | Contenu |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Règles de travail pour Claude (et tout contributeur) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, structure du dépôt, système de modules, permissions |
| [STATUS.md](STATUS.md) | Feuille de route et avancement |
| [docs/](docs/README.md) | Toute la documentation : produit, design, contenu, décisions, légal, ops |

## Licence

[GNU AGPL v3](LICENSE). Le logo de l'EEC appartient à l'Église Évangélique du Cameroun et n'est pas couvert par cette licence.
Les polices non plus : Fraunces (SIL OFL 1.1, `packages/ui/fonts/fraunces/OFL.txt`) ; Switzer, Zodiak et Gambetta
(ITF Free Font License) ne sont pas dans le dépôt — elles sont téléchargées depuis Fontshare par `pnpm fonts:fetch`.
