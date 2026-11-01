# Module `sermons` — Prédications

**Purpose.** Sermons as links (a YouTube video, links to audio on Drive), with an optional text and passages (decision 0034: no audio hosting).

**Data kept.** `sermon_series`, `sermons` (title, summary, text, transcript, date, series, the preacher's name and their **recorded consent**, passages, YouTube id, links, publishing dates).

**Why each field.** Preacher's name: attribution, shown publicly only with a recorded consent (who, when) (decision 0031). The rest is public content.

**Exposure.** Public once published. Admin: `sermons:read|edit|publish` (group-scoped).

**Retention.** Kept (public content). A preacher can withdraw consent: the name is then removed.

**Owners.** Éditeur, secrétariat.
