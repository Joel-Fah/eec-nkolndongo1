# Phase 04: Go-live & Grow

> **Goal:** two tracks.
>
> - **Go-live track:** bring production up to date with Phase 03, prove it on real phones and real numbers,
>   and hand Joël and the parish a launch kit. After that, flipping `SITE_INDEXABLE=1` is a one-line
>   decision **he** takes, whenever the content is ready.
> - **Grow track:** the next parish features from the roadmap:
>   - sermons + podcast
>   - bulletin & meditations
>   - event registrations
>   - the Fête des Moissons campaign
>   - an installable, offline-friendly site (PWA)
>
> Still out: newsletter/email (no domain), payments (pawaPay), sacrament requests.

| | |
|---|---|
| Owner | Joël Fah (approves checkpoints, decides launch, owns accounts and secrets) |
| Builder | Claude Code |
| Branches | `feat/phase-04a-go-live` (Checkpoints 0, A) then `feat/phase-04b-grow` (B, C, D). Sub-branches allowed, squash-merged. |
| Depends on | Phase 03a and 03b merged into `main` (squash, in that order), `docs/phases/PHASE_03_REPORT.md` final |
| Checkpoints | **0** production catch-up & real-world proof · **A** launch kit · **B** sermons & podcast · **C** bulletin, meditations, registrations · **D** Moissons campaign, PWA, wrap-up |

The go-live track comes first on purpose: new features shouldn't pile up on a production that is two phases
behind. If you'd order or split things differently after reading the code, propose it in the plan. Don't
silently drop scope.

---

## 0. Read first (mandatory)

1. `CLAUDE.md`, `STATUS.md`, `ARCHITECTURE.md`.
2. `docs/phases/PHASE_01_REPORT.md`, `PHASE_02_REPORT.md`, `PHASE_03_REPORT.md`. **The code's reality wins
   over this file's assumptions.** Adapt and say so in the plan.
3. All decision records 0001–0033, especially:
   - 0017 (single origin)
   - 0020 (media storage: Neon bucket, egress shared with Postgres)
   - 0021 / 0027 (freshness, rendering, CPU thresholds)
   - 0028 (rich text)
   - 0029 (events / ics)
   - 0031 (consent for people)
   - 0032 (Bible: LSG / WEB only)
   - 0033 (legal versions)
4. `docs/ops/runbook.md`, `docs/ops/ci-cd.md`, `docs/ops/incident.md`, `docs/legal/data-protection.md`,
   `docs/content/PENDING.md` (generated), `docs/product/roadmap.md`, `docs/product/pages.md`.
5. Skills:
   - `new-module`
   - `design-system`
   - `i18n-content`
   - `gsap-motion`
   - `svg-illustration` (note decision 0024: Storyset art, recoloured, never committed)
   - `release-checklist`

Verify current docs before relying on memory: Workers Free limits and metrics, Workers Analytics Engine
availability on Free, Web Audio / WebCodecs encoding support, Apple Podcasts and Spotify RSS requirements,
service worker / Web App Manifest behaviour on Android Chrome and iOS Safari, Neon Free limits.

---

## 1. Checkpoint 0: production catch-up and real-world proof

Joël is present for every production step. Use `.env.production.local` only in a dedicated shell (runbook
« Telling dev from production »).

1. **Merge:** Phase 03a then 03b into `main` (squash). The `deploy` workflow (or the documented manual path)
   ships them.
2. **Production migrations 0006–0017:** create a Neon backup branch first (`pre-phase-03`), apply, then run
   `pnpm db:seed` (idempotent: new permissions, the « Pasteur » role, module flags). List the new
   permissions and roles to grant on the Rôles screen, and do it with Joël. A fresh encrypted backup
   after.
3. **Real readings on production** (the numbers Phase 03 couldn't take):
   - **Worker CPU** p50/p95 per page type, cache hit and miss, from Cloudflare's Workers metrics. Pages: home,
     news list, article, agenda, event, horaires, ce dimanche, départements, a department, guide, notre
     histoire, donner, recherche, `/api/search`. Compare with decision 0027's thresholds (≤ 8 ms keep,
     8–10 ms static shell + fragments, > 10 ms stop and ask).
   - **LCP and CLS** on a **real mid-range Android phone** over mobile data (and the throttled lab profile) for
     the same pages. **Look at the preloader's cost on LCP.** If it pushes LCP past 2.5 s, propose a fix
     (show only on first visit per session, cap its duration, or let LCP content paint under it) and ask
     before changing a brand element.
   - **Egress:** Neon dashboard after a few days. Database egress vs media egress (decision 0020). Record
     both.
4. **Real-device pass** (owed since Phase 01), on a real Android phone:
   - **TalkBack** on home, article, agenda, guide, donner, Mon espace sign-up
   - a full **keyboard audit** (desktop) of the editor, calendar view, publish dialog, liturgical dial, quiz,
     checklist, search dialog
   - **tap-to-dial** merchant code (`%23`) and `geo:` links
   - **`.ics` feed** subscribed in Google Calendar and imported on iOS from the production URL

   Fix what fails. Record what was checked, on which device and browser.
5. **Small carry-overs:**
   - automated test for the sensitive contact flag (only `contact:read-sensitive` sees prayer requests)
   - **signed timestamp** for the contact form's minimum fill time (HMAC with a Worker secret), replacing
     the client-supplied one
   - the **safe preview workflow** against the dev database (runbook mentions it as to-do)
6. **Decisions to ask Joël for (they shape Checkpoint B):**
   - **R2.** Will he add a payment method so R2 can be enabled (free egress, 10 GB)? It's needed for the
     media second copy (`MEDIA_COPY_*`) and is **strongly recommended for sermon audio** (§4.1).
   - **Launch on `workers.dev` or wait for a domain?** Search engines index the URL they first see. Moving
     later means redirects and some ranking loss. Present the trade-off plainly. Joël decides; the domain
     stays on hold unless he says otherwise.

✅ **Checkpoint 0:**
- production on Phase 03
- readings table (CPU, LCP, CLS, egress) with verdicts against the budgets
- the device-pass record and fixes
- carry-overs done
- Joël's answers on R2 and the launch address

Stop.

---

## 2. Launch kit → **Checkpoint A**

Everything the parish needs so launching is boring.

### 2.1 Home texts and figures become slots
Carried over from Phase 03. The hero texts, invitation card and key figures move from `lib/stats.ts` and
messages into `story` page slots, with **validated** flags per figure. Unvalidated items stay hidden in
production. The home page remains a static file filled by its tiny script (decision 0027) or follows the
same on-demand pattern, whichever measures better. Justify the choice.

### 2.2 A validation workflow for the content partner
- New system role **« Validateur de contenu »**:
  - can view everything in the admin that awaits validation
  - can approve settings fields, schedule slots, giving fields and figures (`*:validate` permissions that
    already exist)
  - can **comment**
  - cannot publish news or change roles
- Admin screen **« À valider »**: the live, permission-filtered version of `pnpm content:pending`. Grouped by
  page, each item with:
  - where it appears (link to the public page and to the admin field)
  - current value
  - « Valider » / « Demander une correction » with a comment (audited)

  The admin « À faire » home links to it.
- `pnpm content:pending` keeps working (and reads the same source of truth).

### 2.3 Help for staff, inside the admin
- An **« Aide »** section: short French guides, with English where useful. One per task staff will
  actually do:
  - publish a news item
  - schedule it
  - add an event that repeats and cancel one date
  - fill « Ce dimanche »
  - update service times
  - edit a group page
  - answer the contact inbox
  - relay an outbox message
  - upload photos with good descriptions
  - invite a colleague
  - what « valider » means
- Written as Markdown in the repo (`apps/admin/help/fr/*.md`, `en/*.md`), rendered in the admin with our
  rich-text styles. Screenshots taken from dev with fictional data only.
- Contextual « ? » links from each admin screen to its guide.
- A printable one-page **« Aide-mémoire »** per role (print CSS).

### 2.4 Monitoring that costs nothing
- **Health check:** the existing daily Cron also records a « santé » row:
  - database reachable + latency
  - media bucket reachable
  - last backup age
  - outbox backlog
  - storage used vs free limit

  Shown in admin **Système → Santé** with clear green/amber/red. Warnings at 70 % of any free limit
  (Workers requests/day from metrics if readable, Neon storage, bucket space, egress).
- **Visit counts without tracking:** if **Workers Analytics Engine** is available on the Free plan (verify),
  record a page view server-side per on-demand request. Static assets aren't counted; document the gap. Store
  path + locale + day only: **no cookies, no IP, no user agent beyond a coarse device class**.
  - Show a simple admin chart (top pages, visits per day, FR vs EN).
  - If it isn't available on Free, **skip it and say so**. No third-party analytics, no client beacon.
  - Update `data-protection.md` either way.

### 2.5 Launch-day runbook and SEO readiness
- `docs/ops/launch.md`, a step-by-step for Joël:
  - pre-flight checklist: content validated, privacy policy published (not a draft), real photos or
    approved Pexels, `content:pending` empty for launch-critical items, backup fresh
  - set `SITE_INDEXABLE=1`, deploy
  - verify robots / sitemap / noindex gone
  - submit the sitemap to **Google Search Console** and Bing Webmaster (URL-prefix property with
    meta-tag/file verification, works on `workers.dev`)
  - announce on WhatsApp / Facebook with a ready-made share card
  - rollback (`SITE_INDEXABLE=0`)
- JSON-LD check (`Church`, `NewsArticle`, `Event`, `BreadcrumbList`) against Google's Rich Results Test on
  production URLs; fix errors.
- **Default share image** per page type (OG), generated once from our brand at build time, no runtime
  image service.
- The launch itself is **not** part of this phase's work unless Joël asks for it during the phase.

✅ **Checkpoint A:** demo:
- home slots with validation
- the Validateur role and « À valider » screen
- the Aide section
- Santé + visit counts (or the documented « not available »)
- `launch.md`
- the Rich Results check

Stop. Joël may launch any time after this.

---

## 3. Shared groundwork for the grow track
- Each grow feature is a module (`new-module` skill), on the content kit (lifecycle, rich text, revisions,
  preview, media picker, search documents, `[À VALIDER]` guard, edge-cached JSON + content version,
  `<UnavailableState>`).
- New public pages follow the Phase 02/03 design language (per-page hero concept, bento cards, editorial
  sections). Each gets **its own signature** (`pages.md` spirit) and is documented in `/_brand`.
- **Navigation stays at 5 tabs**:
  - Prédications and Méditations & bulletin go under **Actualités**
  - Inscriptions appear on event pages and in Mon espace (no new tab)
  - Moissons sits under **Agenda** (seasonal) and on **Donner**
- Update `docs/product/navigation.md`.

---

## 4. Module `sermons` (Prédications) + podcast → **Checkpoint B**

### 4.1 Where audio lives (decide first, with Joël)
Sermon audio is the heaviest thing the site will serve. Rough figures:
- 40 min × 64 kbps ≈ 19 MB
- 200 listens/month ≈ 4 GB

That would **exhaust the Neon Free egress shared with the database** (decision 0020). Options, recommended
first:
1. **Cloudflare R2** (free egress, 10 GB). Needs Joël's payment method (asked in Checkpoint 0). Same
   S3-compatible driver: a second bucket `eec-audio` behind `/media/` (or `/audio/`), Range support kept.
2. **YouTube only** (video or audio-with-still) with our page + facade. No podcast feed of our own files.
3. **Internet Archive** hosting with our own RSS pointing to archive.org enclosures. Third-party domain on
   play, so it needs Joël's OK under the no-third-party rule.

Write `docs/decisions/0034-sermon-audio-hosting.md` with the choice. **Don't build audio upload until it's
decided.** Video-only sermons (YouTube) can proceed regardless.

### 4.2 Audio processing in the browser (admin)
- Goal: **podcast-compatible** files that are small. Apple Podcasts and Spotify accept **MP3** and
  **AAC/M4A**, not Opus. Verify current requirements.
- Target **mono, 48–64 kbps**, loudness-normalised (approx. −16 LUFS for podcasts; a simple gain
  normalisation is acceptable if true LUFS is too costly), trim silence at start/end, optional fade.
- Pipeline in a **Web Worker**:
  - decode with Web Audio
  - encode with **WebCodecs AAC** where supported (mux into M4A with a small, maintained muxer)
  - **fallback** to a small JS MP3 encoder

  Verify library health and size. Lazy-load only on the sermon editor. **No ffmpeg.wasm** unless measured
  and justified.
- Show the input/output size, duration, and a preview player before upload. Max input 300 MB. Uploads go
  through the existing media API rules (magic bytes, size).
- The original isn't uploaded. Recommend that staff keep it in **Google Drive** (archive, decision 0006),
  with a help-guide note.

### 4.3 Data & admin
- `sermons`:
  - lifecycle columns (§2.1 of Phase 03)
  - date preached
  - preacher (person with consent per 0031, or role/free text with consent recorded)
  - series (`sermon_series`: title, description, cover)
  - Bible references (structured, LSG/WEB labels per 0032)
  - summary
  - body/notes (rich text)
  - audio media id (with duration and size)
  - YouTube id
  - transcript (optional rich text)
  - tags
  - liturgy link (the Sunday entry, if any)
- Permissions `sermons:*`. Admin list filtered by series/preacher/book.
- **Quick-create from a Sunday entry** (prefills date, readings, preacher).

### 4.4 Public
- **Listening room** `/fr/actualites/predications`:
  - filters (series, preacher, Bible book, year)
  - series pages
  - sermon page: player, readings, notes, share, « Écouter dans votre application »
- **Persistent mini-player** across page navigations (Astro View Transitions `transition:persist`):
  - play/pause, ±15 s, speed (0.8–2×)
  - resume position remembered per sermon (localStorage, try/catch)
  - Media Session API (lock-screen controls)
  - tiny JS, loaded only once audio is played
  - **No autoplay.** Save-Data shows file size before play.
- **Download** link with size.
- **Podcast RSS** per locale (and per series):
  - valid iTunes/Podcasting 2.0 tags (category Religion & Spirituality › Christianity; explicit false;
    artwork 3000×3000 from the brand, generated once)
  - enclosure with exact byte length and type
  - GUIDs stable forever
  - edge-cached

  Validate with a podcast feed validator. Submitting to Apple/Spotify is Joël's step, listed in the runbook.
- Search documents for sermons. Home « Dernière prédication » card in the bento grid.

✅ **Checkpoint B:** demo:
- the audio decision 0034
- in-browser encoding (input vs output size, quality check by ear with Joël)
- the listening room
- the mini-player persisting across pages on a phone, lock-screen controls
- the RSS validator result
- page weights and CPU

Stop.

---

## 5. Module `bulletin` (Bulletin & Méditations)

### 5.1 Weekly bulletin
- `bulletins`:
  - week (Sunday date)
  - lifecycle columns
  - sections as structured blocks: « Annonces » (pick from news `annonce` items or free text), « Ce
    dimanche » (pulled from liturgy), « Agenda de la semaine » (pulled from events), « Méditation de la
    semaine », free rich-text blocks
- Optionally an **uploaded PDF** (the paper bulletin) via the media library.
- **Admin:** « Composer le bulletin de dimanche ». It **auto-assembles a draft** from the week's
  liturgy/events/announcements, and staff edit and publish. Duplicate last week.
- **Public:**
  - `/fr/actualites/bulletin` (latest, plus archive by month)
  - a clean reading page
  - **print / save as PDF** through print CSS (A4 and A5 layouts; no server PDF generation)
  - share to WhatsApp as a link with a good OG card
  - the uploaded PDF (if any) offered as a download with its size

### 5.2 Meditation programme
- `meditation_plans` (title, period, description) and `meditation_days`:
  - date
  - passage(s) (structured references, LSG/WEB per 0032; **verse text only from those translations**)
  - theme
  - short reflection (rich text)
  - prayer line
  - optional liturgist name with consent
- Bulk entry:
  - an admin grid view (date rows, keyboard-friendly)
  - **CSV import** with preview and validation errors per row (the parish often has the programme as a
    printed table)
- **Public:**
  - « Méditation du jour » on the home page (replaces the verse of the day when a plan covers today; the
    verse remains the fallback)
  - `/fr/actualites/meditations`: today, the week, the plan, previous days
  - « Ajouter au calendrier »: an `.ics` of the plan's daily entries at a time the visitor picks, generated
    client-side, nothing stored
- Search documents for both.

---

## 6. Module `registrations` (Inscriptions) → **Checkpoint C**

**Purpose:** retreats, concerts, catechism, JAPE outings, etc. **This is new personal data.** Write
`docs/decisions/0035-registrations-data.md` and update `data-protection.md` **before** building.

- **Form per event** (attached to an `events` item, or standalone for things like catechism enrolment):
  - open / close dates, capacity, waitlist on/off
  - who can register: anyone, or members only (Mon espace)
  - fields. Fixed: name, phone **or** email, number of people. Optional, chosen per form: group, age band,
    short text, single choice, multiple choice, yes/no.
  - **No free-form sensitive questions** (health, ethnicity, religion beyond the obvious context). The form
    builder doesn't offer them, and help text explains why.
- **Children:** activities for minors require the **registrant to be the parent/guardian**. The child's data
  is limited to first name + age band. Guardian consent checkbox (unticked) with the policy version.
- **Public flow:**
  - fast, works without JS, the existing form primitives
  - honeypot + signed timestamp + rate limit (like contact)
  - confirmation page with a **registration code**, an `.ics`, a WhatsApp share of the event, and « Annuler
    mon inscription » via a signed link
  - logged-in members see « Mes inscriptions » in Mon espace
  - capacity reached → waitlist with position. A cancellation promotes the next person, who is notified
    through the **outbox** (no email yet, 0019). The admin sees « à prévenir ».
- **Admin:**
  - per-form list: status, counts, waitlist
  - manual add
  - **check-in mode** on a phone (search by name/code, tap « présent », works on poor connections with
    optimistic UI and retry)
  - CSV export (`registrations:export`, dangerous, audited)
  - group-scoped permissions (a JAPE leader manages JAPE forms only)
- **Retention:** 6 months after the event (already in the legal doc), plus a hard cap. Added to the
  retention Cron. Attendance counts survive anonymised (numbers only) for the parish's records.

✅ **Checkpoint C:** demo:
- bulletin auto-assembly → edit → publish → print preview (A4/A5) → WhatsApp card
- meditation CSV import with an error row, the home « Méditation du jour »
- a registration with capacity → waitlist → cancellation promotes → outbox note
- check-in on a phone
- a minor's registration by a guardian
- export audited
- decision 0035 and the legal doc diff

Stop.

---

## 7. Module `campaigns` (Fête des Moissons)

- `campaigns`:
  - title
  - date range (defaults to the Moissons range in settings)
  - goal amount (XAF)
  - description (rich text)
  - cover
  - status
- `campaign_progress`: entries by the treasurer:
  - amount
  - date
  - optional group (for parishes that run Moissons by group/family/quartier)
  - note
  - **validated** flag (`campaigns:validate`)

  **Only validated totals are public.** No individual donors, ever.
- Optional **group goals** with progress per group. Shown as encouragement (« ensemble »), not a ranking
  by default; a ranking view only if Joël asks.
- **Public** (under Agenda during the season, and highlighted on Donner):
  - the **harvest basket** that fills toward the goal (SVG + GSAP or CSS; Storyset-consistent colours;
    reduced motion = static fill)
  - the amount in XAF formatting (`5 000 FCFA`)
  - days remaining
  - how to give (validated giving fields)
  - the programme of the day (linked events)
  - a share card whose progress is rendered **server-side as SVG**, cached, no image service
- No payments and no amounts collected online (pawaPay is later, decision 0010).

---

## 8. PWA: installable and useful offline

- **Manifest:** names FR/EN, theme colours from tokens (light/dark), maskable icons (exist), `start_url`
  `/fr/` (respect saved locale), `display: standalone`, shortcuts (Ce dimanche, Agenda, Prédications).
- **Service worker** (hand-written or a tiny well-maintained helper; justify and keep it small):
  - **precache:** offline page, CSS, the two fonts, the logo, key icons. Versioned per deploy, old caches
    purged.
  - **runtime:** content pages and their JSON use **network-first with a short timeout, falling back to
    cache**. Cap at ~40 pages and a total size budget (e.g. 15 MB), evicting the oldest.
  - **never cache:** `/api/*` mutations, the admin path, auth routes, Mon espace private data, preview
    links, `/media/*` audio (too large; images are capped by count).
  - offline fallback page (FR/EN, illustration) that lists what's saved and readable offline.
- **« Disponible hors ligne »:** the latest Ce dimanche, this week's agenda, the latest bulletin and today's
  meditation are kept fresh automatically when visited. A small badge shows when a page is served from
  cache.
- **Install:** no nagging banner. A discreet « Installer l'application » entry in the footer and Mon
  espace, using `beforeinstallprompt` where available, and short iOS instructions otherwise.
- **No push notifications** in this phase (consent UX + infrastructure; propose for a later phase).
- **Tests:**
  - Lighthouse PWA/installability on production
  - offline navigation on a real Android phone (airplane mode)
  - update flow after a deploy (no stale shell, no broken admin)
  - Save-Data respected

---

## 9. Quality gates (before Checkpoint D's report)
Run `release-checklist` fully, plus:
- **Budgets** on every new public page:
  - ≤ 100 KB JS gz
  - first load ≤ 250 KB excluding lazy media
  - LCP/CLS on the real Android phone
  - the mini-player and service worker sizes reported
- **CPU** on production for the new on-demand pages, against 0027's thresholds.
- **Egress:** projected monthly media egress with sermons, against the chosen host's limits.
- **Security:**
  - route-table test green with all new routes
  - registration and cancellation links signed and expiring
  - CSV exports audited
  - group scope tested for sermons, bulletin, registrations, campaigns
  - service worker never caches private or admin responses (test it)
- **Privacy:** `data-protection.md` updated (registrations, minors via guardians, visit counts, sermon
  preacher consent). Retention Cron extended and tested.
- **Accessibility:**
  - player controls labelled, keyboard and TalkBack
  - check-in mode usable one-handed
  - offline page readable
  - basket has a text equivalent
- **E2E (manual, `pnpm e2e`):**
  - publish a sermon → appears in RSS
  - bulletin auto-assembly
  - registration → waitlist → cancellation promotes
  - offline: a visited page opens without network
- `pnpm check` green.

✅ **Checkpoint D:** demo the campaign page through a season (dates simulated), the PWA install and offline
behaviour on the phone, and the quality-gate results. Stop.

---

## 10. Wrap-up
1. Decision records:
   - 0034 sermon audio hosting
   - 0035 registrations data
   - 0036 audio encoding pipeline
   - 0037 PWA caching rules
   - 0038 visit counts (or « not available on Free »)
   - 0039 home slots
   - others as needed

   Keep `docs/decisions/README.md` in numeric order.
2. Update:
   - `ARCHITECTURE.md`, `CLAUDE.md`
   - `docs/product/roadmap.md` (Phase 2 items done), `navigation.md`, `pages.md` (new signatures)
   - the runbook (podcast submission, PWA cache bump, check-in day, validator role, Santé)
   - `data-protection.md`
   - the `new-module` skill
   - `/_brand` (every new component: player, mini-player, basket, check-in list, offline page, help
     layout)
3. `STATUS.md`:
   - Phase 04 done
   - production state
   - what's waiting on people (content, photos, merchant details, R2, domain, launch)
   - next phase proposal
4. `docs/phases/PHASE_04_REPORT.md`:
   - built
   - readings (CPU, LCP, CLS, egress, sizes)
   - device-pass record
   - deviations
   - known issues
   - `content:pending` on production
   - suggestions for Phase 05: newsletter when a domain exists, pawaPay, member services (carte de
     Sainte-Cène), push notifications, `pg_trgm` search, department spaces
5. PRs `feat/phase-04a-go-live → main` (after Checkpoint A) and `feat/phase-04b-grow → main` (after D), each
   ready for review, with screenshots (FR/EN, light/dark, 375 and 1440, plus phone photos where the
   check was on a device).

---

## Out of scope
Newsletter and real email (no domain), registering a domain, payments/pawaPay, push notifications, member
services (carte de Sainte-Cène, attendance per member), sacrament requests, third-party analytics, phone/SMS
login, setting `SITE_INDEXABLE=1` (**Joël's** action, see `launch.md`).

## Commit conventions
Conventional Commits scoped by module (`feat(sermons): …`, `feat(pwa): …`, `fix(a11y): …`, `chore(db): …`,
`docs(ops): …`). Migrations in their own commits, additive only. A destructive one needs a decision record
and Joël's OK. Push at checkpoints only.

## Stop and ask Joël when
- any production step (migrations, deploys, secrets, role grants)
- a cost, a payment method, or a free-tier limit at 70 %+
- a third-party domain on any public page (audio host, analytics, embeds)
- a new kind of personal data, or anything about minors
- a brand element changes (preloader, logo usage)
- any parish fact, name, figure, photo, verse text outside LSG/WEB
- docs and code disagree
- the launch itself
