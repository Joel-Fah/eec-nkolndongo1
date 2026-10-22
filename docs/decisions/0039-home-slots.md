# 0039 — Home texts and key figures are content slots, filled by a tiny script
**Status:** Accepted · 2026-10-22
**Context:** The home hero line, the invitation card and the four key figures lived in `lib/stats.ts` and in messages, so
changing them needed a deploy, and a figure (a fact) had no validation of its own.
**Decision:**
1. They become `home` slots of the `story` module (`packages/core/src/page-slots.ts`): `lead`, `invite_title`,
   `invite_text`, and four **number** slots (`fig_years`, `fig_groups`, `fig_sundays`, `fig_members`). A number slot is
   digits only (up to six), the same in both languages.
2. **Publishing a slot is its validation** (`story:publish`, as for the other story texts). A figure that is not published
   is not shown. Editing without `story:publish` takes the text back to draft.
3. The home page **stays a static file** (decision 0027). `lib/home-slots-client.ts`, loaded with the footer script,
   asks the edge-cached `/api/story/public` (the same JSON the story pages use, so no new endpoint and no new database
   work) and replaces the built-in line where a slot is published, then reveals the published figures with their count-up.
   Measured alternative (rendering the home on demand) rejected: it adds ≈ 5–7 ms of CPU to the busiest page for three
   lines of text. If the API is slow or down the page keeps its built-in text and shows no figures.
4. `lib/stats.ts` is deleted: nothing shows an « exemple » figure any more, in dev or in production.
**Consequences:** The footer script now fetches `/api/story/public` on every page (small, cached); the call is skipped on
pages that have no `data-slot` element. The home texts are still French-first with the built-in English fallback.
