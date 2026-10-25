# Phase 04 — Go-live & Grow: report (in progress)

_Updated 2026-10-22, at Checkpoint A (04a)._

## Where the instructions and the code disagreed
| Instruction assumed | Reality | What was done |
|---|---|---|
| Production two phases behind; catch-up with Joël present | Both Phase 03 PRs were merged and `deploy` shipped them, migrations 0006–0018 included, with no backup branch and no seed | Checkpoint 0 production steps reduced to: audit, post-hoc backup branch, seed, role grants (not done yet, see below) |
| JSON-LD and OG tags exist, only to be checked | **Neither existed**; the static sitemap listed only the few prerendered pages | Built: share cards, JSON-LD, an on-demand sitemap (the `@astrojs/sitemap` integration removed) |
| Validation: « comment » on the existing flags | No review thread existed | `content_reviews` table + « À valider » (decision 0040) |
| Help section, markdown, print CSS | None existed | Small escaped renderer (no dependency), 11 guides + 4 cheat sheets, print CSS |
| Home texts in `lib/stats.ts` | Also in messages; the page is static | Slots + tiny client script (decision 0039) |
| Visit counts if Analytics Engine is on Free | Cannot be confirmed from the Worker; a binding to a service not enabled fails the deploy | Code shipped dormant; switched on by Joël (decision 0038, runbook) |
| `pg_trgm` as a Phase 04 suggestion | Already migration 0018 | Nothing to do |

## Checkpoint 0 — done on dev; production and device work deferred by Joël
- ✅ Signed fill-time token for the contact form (HMAC with `AUTH_SECRET`, reuses `signPreview`), tested; the e2e covers a forged token.
- ✅ Automated test for the prayer-request rule (`contact:read-sensitive`) at route level.
- ✅ Safe preview: a separate `eec-nkolndongo1-preview` Worker (own secrets pointing at dev data), `PREVIEW_WORKER=1`.
- ⏳ **Not done (needs Joël / a real phone / production):** production audit, post-hoc backup branch, seed + role grants,
  Worker CPU from Cloudflare metrics, LCP/CLS on a real Android phone (incl. the preloader's cost), Neon egress, TalkBack,
  keyboard audit, tap-to-dial, `geo:`, `.ics` in Google Calendar and iOS, R2 and launch-address answers.
- Lab reading only (local workerd, 4× CPU, slow 4G, warm): LCP 2.2–2.7 s on the content pages (the preloader holds the page ~2.5 s
  on a first visit, so it is the likely floor: **to be measured on the phone before any change**); `/fr/vivre/cultes-et-horaires/`
  8.1 s was a cold database; CLS 0.000; third-party requests 0.

## Checkpoint A — built (dev)
Weights (production build, lab profile): JS 15–16.4 KB gz, first load 158–209 KB; the home page now also asks the cached
`/api/story/public` for its slots (decision 0039). Admin initial JS unchanged (help, validate, health, visits are lazy chunks of
0.6–1.6 KB each; the markdown renderer is 1.3 KB). Share cards ≈ 36–55 KB each (12 files).
- **Home slots** (0039): `lead`, `invite_title`, `invite_text`, four number slots, hidden until published.
- **Validation** (0040): role « Validateur de contenu », permissions `core:validation-read|comment`, screen « À valider », comments.
- **Aide**: 11 guides, 4 cheat sheets (print), « ? » in the top bar; guides written from the real screens and wording.
- **Santé**: `system_health`, `system_marks`; checks: database time, bucket, last backup, outbox, database size, files size.
- **Visit counts** (0038): recorder + admin section, dormant; `deploy.json` + dashboard steps in the runbook.
- **Search/social readiness**: `og:*`/`twitter:*` tags, default cards (`apps/web/public/og`), JSON-LD, `/sitemap.xml`, `scripts/jsonld-check.ts`
  (all good locally). The **Rich Results Test on production URLs** is still to run (needs a public URL).
- **Docs**: `docs/ops/launch.md`, runbook, data-protection, decisions 0038–0040, `/_brand` entries.

## Known issues / open
- Production permissions: after the next deploy, `pnpm db:seed` and the role grants (new: `core:validation-*`, `core:system-health`,
  `core:visits-read`, the `validateur` role).
- `pnpm content:pending` and « À valider » share their sources by convention, not code (decision 0040).
- Static pages (home) are not counted by the visit counter (0038).

## Feedback round on Checkpoint A (2026-10-22) — done on dev
- Tooltips: the browser's grey `title` is replaced by our dark bubble (`data-tip`, CSS only, hover after a pause + keyboard focus) on
  the public header, theme/language buttons, social links and the admin top bar (help, language, theme, profile).
- Help: the page is a grid of icon cards; the contextual « ? » opens a **side sheet** over the screen (abstract random banner,
  title, reading time, « Pour vous »; « Toutes les aides » top left, close top right).
- Health: cards/list toggle (remembered), a status banner and a 7-day strip like a status page, plus a week curve/bars/gauge per check.
- À valider: priority chips (high / keep an eye / not urgent) with icon + words + colour, list sorted by priority.
- **Checkpoint B re-scoped (decision 0034):** no audio hosting and no processing on the site; a sermon holds a YouTube link and/or a
  Google Drive link. No podcast feed until a host with direct file URLs exists (R2 or Internet Archive).

## Checkpoint B — sermons (built on dev, 2026-10-22) — re-scoped by decision 0034
**Scope change (Joël):** no audio hosting and no processing on the site; a sermon holds optional links (any https address, none
required) and an optional YouTube video. Therefore **not built, by decision**: audio upload, the in-browser encoder (0036), the
persistent mini-player with Media Session, the podcast RSS. All parked in 0034 for the day a host with direct file URLs exists.
- **Module `sermons`** (migration 0021, additive): `sermons`, `sermon_series`; content-kit lifecycle (draft / schedule / publish /
  archive, revisions, preview links), permissions `sermons:*`, preacher name public only with a recorded consent (0031), Bible
  passages as references only (0032), `transcript` (optional rich text), link validation (https only, ≤ 4), YouTube id parsing.
- **Admin:** list + series tab, editor with autosave, « reprendre depuis un dimanche » (date, readings, name; never the consent),
  help guide « Ajouter une prédication ».
- **Public:** the listening room (cards, filters series / preacher / book / year without reloads, pagination), the sermon page
  (YouTube facade: nothing requested from YouTube before play, links with their host, notes, written text, WhatsApp share,
  breadcrumbs JSON-LD), search results, sitemap, home « Dernière prédication » (static page + tiny script).
- **Tests:** 7 unit tests (links, YouTube parsing, input); route-table and boundaries tests green; `pnpm check` 81/81.
- **Not done / to decide:** a series has no page of its own (the list is filtered by `?series=`); « Quick-create from a Sunday »
  is a picker inside the editor, not a button on the Sunday; weights (production build, lab profile 4× CPU, slow 4G): list JS 16.1 KB gz / 150 KB first load, sermon page 15 KB / 144 KB, third-party 0; the home 16.6 KB / 209 KB. LCP 2.7–3.2 s on the new pages in this lab run (warm local workerd, dev database): above 2.5 s, to read again on a real phone.

## Checkpoint C — meditations, bulletin and registrations built on dev (decision 0035 accepted 2026-10-23; see STATUS)
- **Meditations** (module `meditations`, migration 0022): programmes (dates, publish), days with up to three readings + a psalm +
  optional headline, reflection and verse of the day; **CSV import** checked line by line in the browser and again on the server
  (`readMeditationCsv` in `@eec/core`); the parish's **real 2026 calendar** (184 days, July–December) is the test fixture: it reads
  with **no error and no unknown book**, and two **warnings** (2026-09-16 and 09-17: the psalm column holds « 1-22 » / « 23-43 »,
  verse ranges without a psalm number: to check with the Bible service). The « Reflection Theme » and « Status » columns are ignored.
- **Passages** are the parish's own printed references (« Amos 4, 1-13 », « Jean 7, 53–8, 11 », « Esaïe 63, 16-19; 64, 2-7 »),
  shown in French as written and in English with the book translated and verses with a colon; **no text is stored**, except the
  verse of the day **if staff type it** (LSG / WEB, decision 0032). The verse of the day is picked from the day's readings and, when it
  has a text, **replaces the home verse for that day** (the general verse stays as the fallback).
- **Public « Méditations et bulletin »:** the meditation of the day (previous/next day without reloading), the week strip, the month's
  programme (custom month select), « Ajouter à mon calendrier » (an .ics built **in the browser** at the hour the visitor picks, nothing
  sent), a home « Méditation du jour » card.
- **Bulletin** (module `bulletin`, migration 0023): « Composer le bulletin de dimanche » assembles a draft **from the site's own public
  data** (this Sunday, the week's events, the meditations, the recent news) in the admin, or copies last week's, or starts empty; blocks
  are editable and reorderable, French and English; publish; public reading page with the archive by month, **A4 / A5 print layouts
  through print CSS** (checked: Chromium prints A4 594×842 pt and A5 420×595 pt; no server PDF), WhatsApp share, and a link to the
  paper bulletin's PDF as any https address.
- **Deviations / not done:** the PDF is a link, not a library file (the media picker only handles images); the news « annonce »
  category does not exist, so announcements are the week's news posts, edited by hand; the OG card for a bulletin is the news card.
- **Registrations:** decision **0035 written as PROPOSED** and `data-protection.md` updated; **no registration code exists**. Questions for
  Joël are at the end of 0035.
- **Also in this round:** the isometric church on the Find us map bounces on click once its drawing is complete.


## Checkpoint D — campaigns, PWA, quality gates (built on dev, 2026-10-24)

**Campaigns (decision 0041).** Module `campaigns` (migration 0028): campaigns, amounts received, optional group goals.
The treasurer enters (`campaigns:progress`), the secretariat validates (`campaigns:validate`); the API refuses validating one's own
entry (super admin excepted) and editing a validated amount removes its validation. Public JSON has **validated sums only**, never rows or notes (e2e
checks it). Public page: basket filling toward the goal (static if motion is reduced, text equivalent), `5 000 FCFA`, days left,
groups as encouragement (alphabetical, no percentages compared), how to give (approved settings), the season's programme (events in
the range), a server-drawn SVG share card; a highlighted block on Donner during the season. Season replay: `?simule=YYYY-MM-DD` on
localhost, `asOf` on the API (earlier totals only). **Roles:** system roles get their grants only when first created, so on every
environment grant them in Rôles: treasurer = read + progress; secretariat = read + edit + validate (also the new `registrations:*`).

**PWA (decision 0037).** Hand-written worker `/sw.js` (**2.6 KB gz**) + `scripts/pwa.ts` (≈1 KB gz): public pages only (whitelist `/fr/…`
`/en/…`), network first 4 s then the saved copy (max 40), never admin/API/auth/Mon espace/previews/registration/search/tokens, nothing
`private`/`no-store`, no audio, images capped (off with Save-Data), offline page FR/EN listing saved pages, a « copy saved » notice,
discreet install entry in the footer (iOS instructions), per-locale manifest with shortcuts, stamped per build (commit or time) so
every deploy updates it, old caches dropped. **Tested:** unit test of the worker's rules (`sw-rules.test.ts`, 7 tests) and a real Chromium
run offline: visited pages open with the notice, unvisited → offline page listing the saved ones, `/mon-espace/` and search never saved.
Not testable here: Android Chrome install, airplane-mode on a phone, iOS (Joël's device pass).

**Quality gates.** `pnpm check` green. New tests: campaign rules (7), service worker (7), **scope matrix for every module** (a grant
for group A never opens group B or the parish; Moissons roles keep entering/validating apart; export only for secretariat) in
`modules/scope.test.ts`. `pnpm e2e` extended (registration → waitlist → cancellation promotes; campaign validated-only totals): all
16 checks pass on the dev stack. Route-table test lists the two public registration mutations; campaigns adds none.
Budgets (lab: Moto G-class emulation, 4× CPU, slow 4G, localhost): JS gz — campaign 16.3 KB, offline 16.3, registration form 16.3,
meditations 18.5, sermons 17.4, Our story 61.1 (GSAP); all ≪ 100 KB. First load: campaign 152 KB, offline 152, registration 144,
meditations 155, sermons 154; **Our story 277 KB** because its pictures load at once (dev pictures, lazy media excluded in the budget
reading, to confirm with real photos). CLS 0.000 everywhere. **LCP numbers here include the full-screen preloader and a cold local Worker,
so they are not the phone readings the brief asks for** (still Joël's; see Known issues).
Accessibility by construction: basket `role="img"` + caption + figures in words; check-in buttons ≥ 56 px, `aria-pressed`; offline page
is plain text/links; chips are buttons. Not done: TalkBack and real-phone keyboard checks.

**Still open (Joël):** real-phone offline/install/LCP/TalkBack passes; production steps (backup branch, `db:seed`, `bible:seed`,
role grants, `CF_ANALYTICS_TOKEN`), PR #6 merge decision, CPU readings on production (0027), egress projection (sermons are links
only, so media egress is unchanged), Rich Results test.


## Checkpoint E — Moissons experience, Sunday reports, open on Sundays (built on dev, 2026-10-24)

**Moissons page (decision 0042).** Members only, in season only (two weeks before to a week after; menu/footer entries and the Donner
block appear only then, from an amount-free teaser JSON). Visitors get a warm teaser with no amount; out of season a « see you next year »
page. Under the unchanged hero, one calm story: the basket fills and the fruit land while the amount counts up (the only place progress
appears), groups as small drifting baskets (a word on hover, never compared), the week's events as a ribbon, giving simply, a closing
invitation with the share card. `/api/me/membership`; the page is `private, no-store`, `noindex`, and added to the service worker's
private list (tested). Static under reduced motion; no motion library (IntersectionObserver + rAF + CSS). Checked: visitor sees no
amount, member sees the story (screenshots at 1280 and 390, no overflow), out-of-season state.

**Sunday reports (decision 0043, module `sundays`, migration 0029).** Attendance (men, women, children) and offering lines (preset or free
purpose, amount, group or the congregation) per Sunday; the secretariat enters attendance and closes the Sunday, the treasurer enters
offerings, a group leader only their group's lines (and no attendance). A « moissons » line may name a campaign and then keeps ONE
unvalidated entry there (raw SQL by table name, no cross-module import): editing the amount un-validates it, deleting the line removes it
while unvalidated. Trends by week or month with change vs the previous period, totals by purpose and by group, CSV export (secretariat +
super admin, audited by row count, no figures in the audit). Never public. Tests: rules (9), scope matrix picks the module up, e2e (5 new
checks, all pass). **Not done:** the « Dimanche dernier » card on the main dashboard (the module has its own Trends tab; the admin charts
live in the app and modules may not import the app: moving them to a shared package is the clean way).

**Open on Sunday.** `/` redirects to « Ce dimanche » the first time each Sunday (parish time) and sets a cookie until that night, so later
visits open the home; `/fr/` and `/en/` are never redirected (`openOnSunday`, unit-tested).

**Grants to give on every environment (Rôles):** treasurer `campaigns:read/progress`, `sundays:read/offerings`; secretariat `campaigns:read/edit/validate`,
`sundays:read/attendance/close/export`, `registrations:*`; pastor `sundays:read`; group leader `sundays:read` (+ `sundays:offerings` for their group if wanted).

**Round after Checkpoint E (2026-10-25):** the thanks card is now stacked, tilted, theme-tinted sheets (no top rule; the SVG share card lost its top bar too);
each group shows its own amount and target at all times; the week ribbon runs edge to edge on phones; the page's background starts and ends on
the page colour so it blends with its neighbours; a Sunday can have several services (migration 0030, tabs per service, a Sunday counts once in
trends); « Dimanche dernier » card on the main dashboard; group names travel with the offering lines.

**Special days and notifications (decision 0044, migration 0031).** A report can be made for any day: a day that is not a Sunday must be named
(suggestions: Nouvel An, Vendredi saint, Ascension, Noël). The top bar has a bell: reminders for the last four Sundays still missing attendance or
offerings (worked out when the list is read, resolved by themselves, grouped by week, deep link to the sheet), read / hide / mark all read.
Tests: `reminders.test.ts`, `rules.test.ts`, e2e (3 new checks). Migration 0031 applied on dev only. Options not built: push, email digest, mute.

**Proposed figures (decision 0045, migration 0032).** Editor-entered Sunday figures are pending until validated by the secretariat (attendance) or the
treasurer (offerings); pending figures count nowhere (totals, trends, dashboard, export, Moissons link) and block closing the Sunday. Validators get
in-app notifications (a Sunday to validate, Moissons entries to validate, a weekly summary); the badge shows up to 99+. **Production:** grant
`sundays:read` and `sundays:propose` to the Editor role in Rôles (system grants are only written at role creation).

**Notification mutes (decision 0046, migration 0033).** A gear in the bell's panel switches each of the four kinds on or off, per person; a silenced kind is not raised, shown or counted (badge and weekly summary). e2e: 3 new notification checks.

## Checkpoint F — profile, card, pickers, social kit, credits (built on dev, 2026-10-25)
**Member profile (decision 0047, migration 0034).** In « Mon espace », after sign-in (the auth flow is untouched), a card suggests completing the profile:
a separate, unticked `profile` consent, then six optional details (birth date, gender, neighbourhood, city, marital status, profession), each with its
purpose written next to it. Staff see an **age band**, never the date; aggregates hide groups under 5; the CSV carries the new columns only for the export
permission. **Photo:** private by default (levels: only me / staff who manage members; never public), resized to a 512 px WebP in the browser, stored under
`private/avatar/…` (not a public media key) and served only by session-checked routes (`/api/me/photo`, `/api/members/:id/photo`), `private, no-store`;
withdrawing the consent, deleting the photo or the account deletes the object. **Generated avatar** (`identiconSvg`) when there is no shared photo, in the
public header, Mon espace and the admin top bar, with a red `!` mark while the profile is incomplete (warn only). **Member card:** brand green, tilts
gently, no download. Audit lines carry field names, never values. e2e: 14 new checks (consent gate, validation, photo privacy, staff level, erasure).
**Pickers:** `DatePicker` / `TimePicker` / `DateTimePicker` (Base UI popover, `Intl`, no library) wrapped as `DateField` / `TimeField` / `DateTimeField`;
all 31 native inputs of the admin replaced; a native-popover version for the two public inputs. **Translation icon** on the language notes and the
« à traduire » cards. **Brand guide:** social kit (Facebook cover, X header, YouTube banner, five profile pictures in two variants, generated by
`pnpm --filter @eec/scripts social:kit` from the shared `abstractArt`), credits, entries for the pickers, avatar, card and warning mark.
**Skills and docs:** `owasp-security` skill; ARCHITECTURE (Phase 04 additions) and CLAUDE (commands, rules) brought up to date.
**Production (Joël):** migration 0034, a new privacy-policy version and notice (0033), the object-store credentials already used by media.

**Review round on Checkpoint F (2026-10-25).** Generated avatar redrawn in our own language and made to fill its frame; Google photo counts as the member's photo
(keep, replace or remove, with the same visibility levels); warning mark on the warning background; the member card and the communion card are one (the
« bientôt » tile is gone); date picker icon `calendar-minus-02`; translation icon centred with its text; Mon espace panels show a turning chevron and a hover;
the admin member record is a hero (photo, name, status, age band, city) plus Contact / Profil / Parcours / Groupes / Consentements cards; **social kit redone**
(ribbons of light in the parish's greens, gold and clay; mark in one corner; square profile pictures that each platform crops) and **credits rewritten** as
an end-of-film roll in the site's voice.
