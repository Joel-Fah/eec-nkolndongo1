# Module `guides` — Vie pratique

**Purpose.** Guided paths for life events (baptism, marriage, bereavement, joining the parish): a guide and its ordered
steps (what to do, documents, duration, who to contact). The public page is a checklist with progress and a print view.

**Data kept.** `guides`, `guide_steps`. **No personal data.** The visitor's ticks stay in their own browser
(`localStorage`), never on the server.

**Public exposure.** Only **published** guides (`/api/guides/public*`). The structure is seeded as drafts; the wording
stays `[À VALIDER]` until the content partner validates it, so nothing unvalidated shows in production.

**Rights.** `guides:read`, `guides:edit`, `guides:publish`, `guides:delete`.

**Retention.** Kept until deleted.
