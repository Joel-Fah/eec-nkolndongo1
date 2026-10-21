# Phase 03: Parish Life (content modules)

> **Goal:** the site stops being a shell. Staff publish and the public site shows, on the existing pages:
>
> - news
> - events and the agenda
> - service times
> - the Sunday and liturgical year
> - departments
> - practical guides
> - the parish story
> - contact
> - giving
> - legal texts
>
> All of it is bilingual, permission-checked, audited, fast on paid mobile data, and **never stating a
> parish fact that hasn't been validated**.
>
> At the end the site is *ready to launch*, but **launching (indexing) is Joël's decision, not this
> phase's.**

| | |
|---|---|
| Owner | Joël Fah (approves checkpoints, content partner validates facts) |
| Builder | Claude Code |
| Branch | `feat/phase-03-parish-life`. Sub-branches per checkpoint are allowed, squash-merged into it. |
| Depends on | Phase 02 merged into `main` and `docs/phases/PHASE_02_REPORT.md` final |
| Checkpoints | **0** carry-overs & render budget · **A** content kit + News · **B** time: events, schedule, liturgy, home · **C** people & story: departments, guides, story pages · **D** contact, giving, legal, search, launch readiness |

If, after reading everything, you think this phase is too large for one branch, propose a split (e.g. 03a = 0–B,
03b = C–D) in your plan. Don't silently drop scope.

---

## 0. Read first (mandatory)

1. `CLAUDE.md`, `STATUS.md`, `ARCHITECTURE.md`.
2. `docs/phases/PHASE_01_REPORT.md`, `docs/phases/PHASE_02_REPORT.md`. **What exists in the code wins
   over what this file assumes.** Adapt and say so in the plan.
3. All decision records, especially:
   - 0016 (dual primitives)
   - 0017 (single origin)
   - 0018 (auth)
   - 0019 (outbox)
   - 0020 (media)
   - 0021 (freshness: `cachedJson` + `contentVersion`)
   - 0023 (Erode)
   - 0024 (Storyset)
   - 0025 (`ADMIN_PATH`)
4. `docs/product/pages.md`, `navigation.md`, `roadmap.md`, `docs/content/README.md`,
   `docs/legal/data-protection.md`, `docs/ops/runbook.md`.
5. The current public UI. The revamp from Phase 02 is the visual direction: per-page heroes in
   `apps/web/src/lib/heroes.ts`, bento cards, editorial sections, the floating footer, the season strip.
   **Phase 03 wires real data into that design; it does not redesign it.** New UI follows the same
   language and is documented in `/_brand`.
6. Skills:
   - `new-module` (the reference for every module here)
   - `design-system`
   - `i18n-content`
   - `gsap-motion`
   - `pexels-curation`
   - `release-checklist`

Verify current library and platform docs before relying on memory (TipTap/ProseMirror, Astro on-demand
rendering on Workers, Cache API, Postgres full-text search on Neon, iCalendar).

---

## 1. Checkpoint 0: Phase 02 carry-overs and the render budget

Phase 03 moves editable content to **on-demand rendering in the Worker**, so we must know the real CPU cost
first. Do these **before** any module work. Each item needs Joël.

1. **First production deploy** (runbook, `scripts/ops/first-deploy.sh`) with Joël present. Neon
   `production` branch, Hyperdrive, Worker secrets, `SITE_INDEXABLE` off, super admin bootstrapped.
2. **Measure Worker CPU** on the deployed Worker, using Cloudflare's metrics or `wrangler tail` CPU time:
   - sign-in
   - session read
   - an `/api/settings/public` cache hit and miss
   - a prototype on-demand Astro page that renders a list of 10 items from a JSON payload, cache miss vs
     cache hit

   Report p50/p95. **Free plan limit: 10 ms CPU per request.**
3. **Decide the rendering strategy** from the numbers and write `docs/decisions/0027-content-rendering.md`:
   - **Default:** content pages are rendered on demand, and their **HTML** is stored in the Cache API with
     the module's `contentVersion` in the key. Use short freshness + stale-while-revalidate, same as 0021.
     A cache hit must cost well under 10 ms.
   - If a cache-miss render exceeds the budget, choose the lighter path. The page shell is static and the
     data comes as **server-rendered HTML fragments** or JSON hydrated by a tiny script, keeping the
     content in the HTML for SEO wherever possible. Or ask Joël about Workers Paid. **Never switch plans
     without his OK.**
   - **Never block a page on a cold or unavailable database:** time-box DB reads (~1.5 s), then serve
     stale. If there's nothing stale, render a graceful « contenu momentanément indisponible » state.
     Never a 500.
4. **Pexels selection:** run the curation (24–36 images, no people) and show Joël the thumbnails. Import
   only what he approves.
5. **Media second copy:** ask Joël to choose:
   - (a) R2 when he adds a payment method
   - (b) the weekly `backup` workflow also copies new media objects, encrypted, to the backups bucket,
     with Joël copying monthly to Google Drive
   - (c) defer

   Record the answer in the report.
6. **Bible text licensing:** the login verses use PDV/ETR (see STATUS). Recommend **public-domain
   translations by default**: Louis Segond 1910 (FR) and the World English Bible (EN). Any other
   translation only with the parish's confirmed permission. Ask Joël, then apply it to §6.3 (verse of the
   day) and the login.

✅ **Checkpoint 0:** CPU table, decision 0027, deploy confirmed, Pexels approved, answers to 5 and 6. Stop.

---

## 2. Shared content kit (build once, use in every module)

Modules in this phase must be thin. The shared parts live in the kits (`@eec/api-kit`, `@eec/admin-kit`,
`packages/ui`, `packages/db`) and are documented in `/_brand` and the `new-module` skill.

### 2.1 Content lifecycle (DB helpers + API helpers)

**Columns** (helper in `packages/db`):
- `status` (`draft` | `published` | `archived`)
- `published_at` (timestamptz; a future value = scheduled)
- `unpublished_at` (optional expiry)
- `slug_fr` / `slug_en`
- `title_fr` / `title_en`
- `summary_fr` / `summary_en`
- `body_fr` / `body_en` (structured JSON, §2.2)
- `cover_media_id`
- `seo_title_*`, `seo_description_*`
- `group_id` (nullable, for group-scoped permissions)
- audit columns

**Rules:**
- **Scheduling needs no cron.** Public reads filter `status='published' AND published_at <= now() AND
  (unpublished_at IS NULL OR unpublished_at > now())`. Short cache freshness makes a scheduled item appear
  within ~2 minutes.
- **Permissions per module:** `<id>:read` (admin), `<id>:create`, `<id>:update`, `<id>:publish`,
  `<id>:delete` (dangerous). Group-scoped when the module is `scopedByGroup`.
- **Revisions:** `content_revisions` (module, entity_id, snapshot JSON, actor, created_at). Keep the last 20
  per item. Restore from a drawer.
- **Slugs:** generated from the title (`@eec/core` slug) and unique per locale. `content_redirects` records
  old → new slugs so a changed slug answers 301.
- **Preview:** drafts open on the public site through a signed, expiring preview link. It is noindex, never
  cached, and shows a « Aperçu — non publié » ribbon.
- **Bilingual:** FR required, EN optional. Public EN pages fall back to FR with a small « Traduit
  prochainement — affiché en français » note. The admin shows a « traduction manquante » badge.
- **`[À VALIDER]` guard:** the public renderer **never shows content containing `[À VALIDER`** in
  production. It hides the item or block and logs a warning. A test covers it.
- Every mutation is audited and bumps `contentVersion('<module>')`.

### 2.2 Rich text: a restricted block schema
- **Editor:** TipTap (ProseMirror), **lazy-loaded** on the admin's editor routes only. Allowed nodes:
  - paragraph
  - H2 / H3
  - bold, italic, link (internal or https only)
  - bullet and ordered lists
  - quote → rendered as `<Verse>`
  - callout (info / gentle warning)
  - image (from the media library, alt text required)
  - Bible reference (book, chapter:verse, translation label)
  - YouTube video (ID only, rendered as a click-to-load facade)
  - divider → `<Ornament>`

  Nothing else: no raw HTML, no colours, no font sizes.
- Stored as JSON, validated by a Zod schema on the API.
- **Server-side renderer** (`packages/ui`, Astro) turns the JSON into HTML with our components.
  - Links get `rel="noopener"` when external.
  - Images use `<Picture>`.
  - It produces no inline styles.
  - A test feeds hostile input (script, `javascript:` links, unknown nodes) and expects safe output.
- Reading time and a plain-text excerpt are derived from the JSON.

### 2.3 Admin components (`@eec/admin-kit` / `packages/ui/react`)
- `<ContentList>`:
  - search, filters (status, group, date), sort
  - status pills (Brouillon / Programmé / Publié / Archivé)
  - bulk archive
  - an illustrated empty state
- `<ContentEditor>`:
  - FR / EN tabs, side by side on wide screens
  - title → slug preview
  - summary
  - body editor
  - cover via **`<MediaPicker>`** (build it now: pick or upload, alt required, ThumbHash preview)
  - SEO panel with a search-result preview
  - group selector (limited to the user's scoped groups)
  - autosave of the draft (debounced, plus a local safety copy)
  - « Enregistré il y a X s » indicator
  - leave-page guard
- `<PublishDialog>`: publish now / schedule (date-time in Africa/Douala) / unpublish at. It shows what
  will be public and in which languages, and warns if EN is missing.
- `<RevisionsDrawer>`: list, compare (fields changed), restore (audited).
- Preview button that opens the signed preview link.
- Plain French throughout, keyboard-complete, light/dark.

### 2.4 Public building blocks (`packages/ui/astro`)
- `<RichText>`
- `<ContentCard>` (bento-compatible)
- `<Pager>` (no-JS links)
- `<ShareBar>` (WhatsApp, copy link, native share where available; no third-party scripts)
- `<EmptyState>` with Storyset art
- `<UnavailableState>` (DB down, no stale copy)
- `<LangFallbackNote>`
- `<Breadcrumbs>`

### 2.5 SEO & feeds (shared)
- Per item: title, description, canonical, `hreflang` pairs (only when EN exists), OG and Twitter image
  (the cover's 1200-ish variant, or a default per page).
- JSON-LD:
  - `Church` (PlaceOfWorship) organisation on the home page, with approved settings values only
  - `NewsArticle`
  - `Event`
  - `BreadcrumbList`
- **Sitemap** becomes on-demand and cached. It includes published items in both locales and excludes
  `_brand`, previews and `[À VALIDER]` items.
- `SITE_INDEXABLE` off still wins: noindex everywhere until launch.

### 2.6 Search foundations (used in §9)
Each module provides a `searchDocuments()` view: id, type, locale, title, excerpt, url, weights, updated_at.
Postgres full-text search uses the `french` and `english` configurations plus `unaccent` (check Neon
support), with GIN indexes. No external search service, no build-time index (content is dynamic).

✅ The kit is done when the `news` pilot (§3) uses all of it without module-specific workarounds.

---

## 3. Module `news` (pilot) → **Checkpoint A**

**Purpose:** Actualités: parish news, announcements and short notices.

| | |
|---|---|
| Data | Lifecycle columns (§2.1) + `kind` (`article` \| `annonce`) + `pinned` (bool) + `banner` (bool, with `banner_until`) + `tags` |
| Permissions | `news:read/create/update/publish/delete`, group-scoped (a JAPE leader can post JAPE news only) |
| Admin | `<ContentList>` + `<ContentEditor>`; « Annonce » = short text + optional link, no body required |
| Public | `/fr/actualites` (Nouvelles): editorial magazine layout, featured + list, filter by tag/group, `<Pager>`. Article page: cover, `<RichText>`, reading time, `<ShareBar>`, « À lire aussi » (3 related by tag/group) |
| Banner | One active `banner=true` item shows as the dismissible site-wide info/promo banner with illustration slot. Dismissal remembered per browser (try/catch). It expires automatically. |
| Feeds | RSS 2.0 per locale (`/fr/actualites/rss.xml`), cached |
| Home | « Dernières nouvelles » (3 latest) in the existing bento grid |

**Seed (dev only):** 6 obviously fictional articles (« Exemple — … ») so layouts can be judged. **Never in
production.**

✅ **Checkpoint A:** a demo on the deployed preview (or local single origin):
- write → autosave → preview → schedule → appears; revisions restore; slug change → 301
- the group-scoped leader cannot touch another group's news
- banner, RSS, EN fallback note
- CPU of the article page (miss/hit) and its JS weight

Stop.

---

## 4. Module `events` (Agenda)

| | |
|---|---|
| Data | Lifecycle columns + `starts_at`, `ends_at`, `all_day`, `timezone` (default `Africa/Douala`), `recurrence` (structured subset: weekly by weekday(s) / monthly by nth weekday / monthly by date; `until` or `count`), `exceptions` (cancelled dates, moved occurrences), `location_kind` (`temple` \| `other`), `location_text_*`, `group_id`, `featured`, `registration_url` (optional, https; real registrations are a later module) |
| Permissions | `events:*`, group-scoped |
| Expansion | Occurrences are expanded **server-side** for a requested window (max 18 months), with a tested pure function in `@eec/core`. DST is irrelevant for Douala but handle timezones properly anyway. |
| Admin | List + **calendar view** (month/week) with drag to reschedule a single occurrence (creates an exception), duplicate event, cancel an occurrence (with an optional public note « annulé »). |
| Public | `/fr/agenda`: list by default (« Cette semaine », « Ce mois-ci », « Plus tard »), month view toggle, filter by group. Event page: date block, place, group, description, add-to-calendar, share, « Itinéraire » (§10.3). Cancelled occurrences show clearly struck through with the note. |
| Calendar files | `.ics` per event (all occurrences) and **subscribable feeds** (`/fr/agenda/calendrier.ics`, and per group `?groupe=jape`), RFC 5545-valid, cached. Test against Google Calendar and iOS import. |
| Header | The « Agenda » mega-panel highlight shows the next featured (or next) event, read from cached JSON. |
| Home | « Prochainement » (next 3 occurrences) |

---

## 5. Module `schedule` (Cultes & horaires)

**Why separate from events:** these are standing weekly rhythms plus office hours, edited rarely and shown
everywhere. One-off and special celebrations stay in `events`.

| | |
|---|---|
| Data | `schedule_slots`: kind (`culte` \| `culte_enfants` \| `etude_biblique` \| `priere` \| `repetition` \| `permanence` \| `autre`), label_fr/en, weekday, start/end time, place, group_id (optional), notes, order, **validated** (bool, approved by `schedule:validate`, like settings). `schedule_exceptions`: date, slot (or all), kind (`cancelled` \| `changed` \| `extra`), note_fr/en. |
| Permissions | `schedule:read/update/validate` |
| Public | `/fr/vivre/cultes-et-horaires`: a calm week view (« clock »), with exceptions highlighted for the coming 14 days; « Ajouter à mon calendrier » per slot (ics). **Only validated slots are shown.** With none validated, show the existing « bientôt » state. |
| Everywhere | A tiny `nextService()` helper feeds the home « Ce dimanche » card and the footer/header « Prochain culte » line. It uses Africa/Douala and handles « aujourd'hui / demain / dimanche ». |
| Agenda | Services optionally appear in the agenda (a toggle in the agenda filters, off by default to keep it readable) |

---

## 6. Module `liturgy` (Ce dimanche, l'année liturgique)

### 6.1 Sunday entries (« Ce dimanche »)
- **Data:** `liturgy_sundays`:
  - date (unique)
  - liturgical name FR/EN (e.g. « 2e dimanche de l'Avent »; prefilled from `@eec/core` season logic,
    editable)
  - theme FR/EN
  - readings (structured Bible references: book, chapter, verses; display label per locale)
  - preacher and liturgist **display names** (free text; public only if the person agreed: consent
    checkbox recorded with who confirmed it)
  - hymns (optional numbers/titles)
  - notes
  - status/published_at
- **Admin:** a « Dimanches » list shows the next 8 Sundays, with empty ones flagged. Quick-fill with keyboard,
  plus « dupliquer la semaine précédente ».
- **Public:** the home **« Ce dimanche » card** (the coming Sunday, or today's until 14:00):
  - season colour
  - name, theme, readings
  - « Culte à 09h00 », from validated schedule only
  - add to calendar

  A dedicated `/fr/agenda/ce-dimanche` page also lists the previous and next Sundays.

### 6.2 The year (Année liturgique)
- Season texts FR/EN (meaning, colour, what happens at the parish) are editable per season. The nine
  seasons already exist in tokens and `@eec/core`.
- The Moissons date range and the season override come from settings (Phase 02).
- **Public `/fr/agenda/annee-liturgique`:** the interactive **circular dial** from `pages.md`.
  - SVG + small vanilla TS or GSAP, no React. Drag or rotate with pointer, arrow keys, and buttons.
  - The current season is marked.
  - Selecting a season shows its text and upcoming Sundays.
  - Reduced motion: no inertia. Without JS: a list of seasons.
  - Document it in `/_brand`.

### 6.3 Verse of the day
- `liturgy_verses`: reference, text_fr / text_en, translation label (per the §1.6 decision), optional date
  or season tag, status.
- Selection order: a dated verse for today → a verse for the current season → a deterministic pick by date
  from the active pool.
- Shown on the home page and (optionally) the admin login. Always with the reference and the translation
  label.
- **No verse text is seeded** unless it comes from the agreed public-domain translation. Seed
  references only otherwise.

✅ **Checkpoint B** (after §4–§6): demo the time-based modules.
- the agenda (list + month, filters), a recurring event with a cancelled occurrence, the calendar feeds
  imported into Google Calendar and iOS
- the schedule week view and `nextService()`
- Sunday entries, the home « Ce dimanche » card, the dial, the verse of the day
- the home wired with « Ce dimanche », « Prochainement » and « Dernières nouvelles », plus its CPU (miss/hit)
  and JS weight

Stop.

---

## 7. Module `departments` (Vivre → Départements)

**Builds on the core `groups` table; it does not duplicate it.**

| | |
|---|---|
| Data | `department_pages` (1:1 with `groups` where `kind` in department/committee/choir): tagline_fr/en, body (rich text), cover/gallery (media), meeting info (free text **or** linked schedule slots), contact (WhatsApp link or phone, optional), audience tags (`jeunes`, `femmes`, `hommes`, `enfants`, `musique`, `priere`, `service`, `etude`, `accueil`…), public order, status. `department_people`: user or free name, role title FR/EN, photo (media), **public consent** (bool + who recorded it + date), order. |
| Permissions | `departments:update/publish`, group-scoped: a *Responsable de groupe* edits **only their group's page**. Test it (JAPE ≠ UFC). |
| Public index | The « choir » layout from `pages.md`: each group a voice/card, filter by audience tag. |
| Group page | Hero, what we do, when we meet, people (only consented ones; otherwise role titles only), latest news and next events of the group (from `news`/`events` by `group_id`), contact button. |
| Quiz « Où est ta place ? » | 3 questions → audience tags → 1–3 suggested groups with a « Pourquoi » line. Questions and answer→tag mapping are editable in the admin (simple form, FR/EN). No data stored: everything happens in the browser. Progressive: without JS, show the filterable list. |

---

## 8. Module `guides` (Vie pratique) and module `pages` (story pages)

### 8.1 `guides`: guided paths
- **Data:** `guides` (lifecycle columns + icon + order + audience) and `guide_steps` (order, title_fr/en,
  body rich text, documents list FR/EN, duration estimate, who to contact: a linked person/role or the
  secretariat).
- Seed the **structure only**, with titles from `pages.md`: baptême d'enfant, baptême d'adulte /
  confirmation, mariage (bénédiction nuptiale), deuil et service funèbre, adhésion à la paroisse. Bodies
  stay `[À VALIDER]` and are therefore hidden in production.
- **Public:** guide index (cards), then a guide page as a **step checklist with progress**:
  - ticks saved in `localStorage` (try/catch), not on the server
  - « Imprimer la liste » (print CSS, no PDF generation)
  - « Poser une question » → contact form prefilled with the guide as subject
  - accordion steps, keyboard-complete

### 8.2 `pages`: editable story content
The story pages' **structure and animation live in code**. Their **words and images live in the admin**.
This is not a page builder.
- **Content slots:** `page_slots` (page key, slot key, text/rich text/media FR/EN, status). Each story page
  declares its slots in code (key, type, max length, help text). The admin shows a form per page in the
  order of the page, with a live preview link.
- **History timeline** (Notre histoire): `history_milestones` (year or date, title, body, image, order,
  status).
  - **Public:** the « Gravir la colline » scroll from `pages.md`. GSAP ScrollTrigger, milestones along a
    path up the hill (a SVG path drawn with our tokens, no tracing of references), tap to expand, ending
    with « Et vous ? » → Nous trouver / Mon espace.
  - Mobile: vertical, no pinning unless tested on a low-end Android.
  - Reduced motion: a plain timeline.
  - Budget: GSAP only on this page.
- **Beliefs** (Ce que nous croyons): the Creed text and short explanations become slots. Keep the existing
  phrase-by-phrase light-up.
- **Pastors & Council** (Pasteurs & Conseil): `council_members` (name, role FR/EN, photo, order, **public
  consent** as in §7, term dates optional), grouped by role (Pasteur titulaire, Pasteur en second,
  Catéchiste, Anciens, Diacres, Commissions). With no consented members, show the governance explanation
  (rich text slot) and role cards without names.
- **Home:** hero texts, invitation card and key figures move from `lib/stats.ts` into slots/settings. Each
  figure has `validated`; **non-validated figures are hidden in production** (as today).

✅ **Checkpoint C** (after §7–§8, with B already approved): demo:
- department pages and the scoped editing
- the quiz
- a guide checklist
- slot editing with preview
- the history climb on desktop and on a throttled mobile profile
- council page with/without consent

Stop.

---

## 9. Search (header button becomes real)

- `/fr/recherche?q=…` is server-rendered (works without JS) and cached briefly per query (normalised).
- Results are grouped by type (Nouvelles, Agenda, Vie pratique, Départements, Pages), with highlighted
  excerpts, locale-aware, accent-insensitive.
- The header search button opens a dialog with an input. With JS, it shows debounced instant results
  from `/api/search?q=` (top 6, cached). Enter goes to the full page.
- Shows suggestions (popular guides, next event) when empty, and a friendly no-results state with an
  illustration.
- Rate-limited (Postgres limiter from 0018). Queries are not logged with any user id.

---

## 10. Module `contact`, `giving`, `legal` → **Checkpoint D**

### 10.1 `contact`
- **Form** (`/fr/decouvrir/nous-trouver` and/or a contact page, follow the existing navigation):
  - name
  - email **or** phone (at least one)
  - category (Renseignement, Vie pratique, Départements, Prière, Autre)
  - message
  - **unticked consent**
- **Anti-spam without third parties:** honeypot field, minimum fill time, rate limit per IP hash, length
  limits. Turnstile only if spam proves real, and only after asking (it's a third-party request).
- Stored in `contact_messages`. **A prayer request** is flagged sensitive: visible only with
  `contact:read-sensitive`, never exported, and has shorter retention. Put that in the legal doc.
- **Admin inbox:**
  - new / in progress / handled
  - assign to a user
  - internal notes
  - reply via WhatsApp deep link or `mailto:` / `tel:` buttons (no email sending, 0019)
  - New messages counted on the admin home « À faire »
- Retention: 12 months after « traité », prayer requests 3 months. Added to the retention job.

### 10.2 `giving` (Donner)
- Data in a settings-like section with **per-field validation** (only approved values are public):
  - MTN MoMo and Orange Money merchant names/numbers or merchant codes
  - bank name, account holder, account number/IBAN-like reference
  - purposes (Dîme, Offrande, Projets, Fête des Moissons) with short texts
- **Public:**
  - gratitude-first page (existing design)
  - « Copier le numéro » buttons
  - when a USSD merchant code is approved, a **tap-to-dial** link (`tel:` with `#` encoded as `%23`),
    tested on Android
  - a short « Comment nous utilisons vos dons » rich-text slot
  - during the Moissons date range (settings), a highlighted Moissons block
- **Nothing is shown until validated.** Before that, a warm « bientôt » state with the secretariat contact.
- **No payment integration** (pawaPay is a later phase, decision 0010). No amounts collected, no donor
  data stored.

### 10.3 Nous trouver (location)
- Approved coordinates and address from settings.
- The illustrated map of the hill stays decorative.
- **« Itinéraire » deep links:** `geo:` URI (Android), Google Maps and OpenStreetMap URLs. **No embedded map
  tiles** (no third-party load, no data cost).
- Landmarks text slot (« près de… »).

### 10.4 `legal`
- Privacy policy, mentions légales and credits (Pexels photographers from the media library's
  `source='pexels'` items, Storyset, fonts) as **versioned** rich-text documents, editable by
  `legal:update`.
- Publishing a new privacy version bumps `policy_version`. Members see a gentle « La politique a changé »
  notice in Mon espace with the change summary. Re-consent is required only when the purposes change (a
  checkbox on publish: « changement de finalité »).
- Update `docs/legal/data-protection.md` for every new data type in this phase:
  - contact messages
  - prayer requests
  - consented public profiles of council/department people
  - preview links

✅ **Checkpoint D:** demo contact (including spam traps and the sensitive flag), giving (validated vs
not), Nous trouver links on a phone, search, legal versioning. Then run the launch-readiness pass (§12).
Stop.

---

## 11. Admin home: « À faire »
Turn the admin home into a useful daily view, filtered by permissions:
- drafts I'm working on
- scheduled items (next 7 days)
- empty Sundays in the next 4 weeks
- unvalidated schedule slots / settings / giving fields
- new contact messages
- outbox items
- missing EN translations (count, with a link to the filtered list)
- media space meter

Keep the headcount dashboard from Phase 02.

---

## 12. Quality gates and launch readiness (before Checkpoint D's report)

Run the `release-checklist` skill fully, plus:

- **Budgets:**
  - every public page ≤ 100 KB JS gz, first load ≤ 250 KB excluding lazy media
  - LCP < 2.5 s, CLS < 0.05 on throttled 4G
  - report per page: home, news list, article, agenda, event, horaires, ce dimanche, année liturgique,
    départements, department page, guide, notre histoire, donner, recherche
  - **Worker CPU** p50/p95 for cache hit and miss on those pages, against decision 0027
  - **Neon egress** estimate per 1 000 visits
- **Resilience:** with the database unreachable, each content page serves stale HTML or
  `<UnavailableState>`. Never a 500 on public pages. Simulate it.
- **Security:** route-table test still green with the new routes; XSS tests on the rich-text renderer;
  preview links expire and are noindex; scoped permissions tested for news, events and departments;
  contact spam traps tested.
- **Accessibility:** keyboard pass on the editor, calendar view, publish dialog, dial, quiz, checklist and
  search dialog. **A real screen-reader pass (TalkBack on Android)** on home, article, agenda, guide and
  donner (carried over from Phases 01–02).
- **E2E (manual run, not CI, per `ci-cd.md`):** Playwright script `pnpm e2e` covering:
  - publish → visible
  - schedule → visible later
  - event recurrence + cancel occurrence → ics
  - contact submit → inbox
  - search

  Document how to run it in the runbook.
- **Content truth:** a report listing every public place still waiting for validated content (« bientôt »
  states), generated by a script (`pnpm content:pending`) from `[À VALIDER]` markers and unvalidated flags.
  That list goes to Joël and the content partner.
- `pnpm check` green.

---

## 13. Wrap-up
1. Decision records:
   - 0027 content rendering
   - 0028 rich-text schema
   - 0029 events recurrence & calendar feeds
   - 0030 search (Postgres FTS)
   - 0031 public profiles & consent
   - 0032 Bible translations (from §1.6)
   - others as needed

   Update `docs/decisions/README.md` (keep it in numeric order).
2. Update:
   - `ARCHITECTURE.md` (§3 layout with the new modules, §6 rendering, §7 media: it says R2/AVIF, reality
     is Neon storage/WebP per 0020, so fix it)
   - `CLAUDE.md` stack line (it still says Neon Auth, R2, "display serif": align it with 0018, 0020, 0023)
   - `docs/product/roadmap.md` (mark Phase 1 modules done)
   - `docs/content/README.md` (tracker from `content:pending`)
   - `docs/legal/data-protection.md`
   - the `new-module` skill (with the content kit)
   - `/_brand` (every new component and pattern)
3. `STATUS.md`: Phase 03 done; next = launch (Joël's call: content validated, real photos, privacy
   reviewed, `SITE_INDEXABLE=1`) and Phase 04 (sermons + podcast, bulletin/meditations, registrations,
   newsletter when a domain exists, Moissons campaign page, PWA).
4. `docs/phases/PHASE_03_REPORT.md`:
   - what was built
   - measurements (CPU, weights, egress)
   - deviations
   - known issues
   - the content-pending list
   - suggestions for Phase 04
5. PR `feat/phase-03-parish-life → main`, ready for review, with screenshots (FR/EN, light/dark, 375 and
   1440).

---

## Out of scope (Phase 04+)
- sermons/audio and the podcast feed
- bulletin and meditation programme
- event registrations
- newsletter and real email (domain)
- online payments (pawaPay)
- Moissons campaign page with goal tracker
- PWA/offline
- member services (carte de Sainte-Cène)
- sacrament requests
- analytics
- phone/SMS login
- registering a domain
- setting `SITE_INDEXABLE=1`

## Commit conventions
Conventional Commits scoped by module (`feat(news): …`, `feat(events): …`, `feat(content-kit): …`,
`chore(db): …`). Migrations in their own commits. Push at checkpoints only. Additive migrations only; a
destructive one needs a decision record and Joël's OK.

## Stop and ask Joël when
- CPU or a free-tier limit would be exceeded, or a cost would appear
- a third-party script or request is tempting (maps, captcha, embeds beyond the YouTube facade)
- a new kind of personal data appears
- any parish fact, name, photo or figure is needed
- a Bible translation other than the agreed one
- docs and code disagree
- before any production deploy of this phase's migrations
