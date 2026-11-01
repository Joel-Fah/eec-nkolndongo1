# Phase 05: Release, then Mon espace & group life

> **Goal:**
> 1. **Release what's built.** Phase 04 sits on dev: 12 migrations, new roles and permissions, a new privacy
>    version. Ship it to production safely and finally do the real-phone checks that have been deferred since
>    Phase 01.
> 2. **Get the legal footing right for member data.** Church membership reveals a religious belief. Under
>    most data-protection laws, including Cameroon's Loi n°2024/017, that is **sensitive data**. The member
>    space has grown (profile details, photo, groups, registrations, Sunday figures), and the communion card
>    and group rosters will make it more so. Settle it before building more.
> 3. **Make « Mon espace » the member's real home:** one well-planned space with:
>    - my Sunday
>    - my groups
>    - my registrations
>    - my notifications
>    - my profile
>    - **the carte de Sainte-Cène** (planned properly this time, decision 0047)
> 4. **Give group leaders a space** (roster, join requests, announcements, their group's events and forms),
>    and decide on **push notifications**.
>
> Still out: newsletter/email (no domain), payments (no merchant details yet), audio/podcast hosting (0034),
> sacrament requests, phone/SMS login.

| | |
|---|---|
| Owner | Joël Fah (approves checkpoints, authorises every production step, obtains council and legal answers) |
| Builder | Claude Code |
| Branches | `feat/phase-04*` merged first (Checkpoint 0), then `feat/phase-05a-member-home` (A, B) and `feat/phase-05b-community` (C, D) |
| Depends on | Phase 04 report final (`docs/phases/PHASE_04_REPORT.md`, wrap-up 2026-10-25) |
| Checkpoints | **0** release Phase 04 + device pass · **L** legal footing for member data · **A** Mon espace foundation · **B** groups for members & leaders' spaces · **C** carte de Sainte-Cène · **D** push decision, data-rights log, wrap-up |

---

## A word on order (read this before planning)
Production work was deferred during Phase 04, and that was a fair call while features were still moving. But
the gap is now large: Phase 04's 12 migrations (0024–0035), new roles, seeds and a privacy version. Every new
feature makes the eventual release riskier, and **the real-phone checks have never been done in five
phases**. That includes LCP with the preloader, TalkBack, tap-to-dial, `.ics` on phones, PWA install and
offline.

So Checkpoint 0 comes first. **If Joël defers production again**, dev work may continue (L, A, B…), but:
- nothing is merged into `main` (merging deploys)
- each checkpoint report repeats the growing release list in a box at the top
- no migration may assume production already has Phase 04

Say this plainly in the plan, and don't let it slide silently.

---

## 0. Read first (mandatory)
1. `CLAUDE.md`, `STATUS.md`, `ARCHITECTURE.md`.
2. The four phase reports, especially `PHASE_04_REPORT.md` (wrap-up, known issues, the grants lists,
   production steps). **The code's reality wins over this file.** Adapt and say so in the plan.
3. All decision records 0001–0047, especially:
   - 0018 (auth)
   - 0019 (outbox)
   - 0031 (consent for people)
   - 0033 (legal versions)
   - 0035 (registrations)
   - 0037 (PWA)
   - 0040 (validation)
   - 0043–0046 (Sunday reports, notifications, mutes)
   - 0047 (profile, photo, the card plan)
4. `docs/legal/data-protection.md`, `docs/ops/runbook.md`, `docs/ops/launch.md`, `docs/ops/incident.md`,
   `docs/ops/ci-cd.md`, `docs/product/roadmap.md`, `navigation.md`, `pages.md`.
5. Skills:
   - `new-module`
   - `design-system`
   - `i18n-content`
   - `gsap-motion`
   - `owasp-security`
   - `release-checklist`

Verify current docs before relying on memory:
- Web Push (VAPID, payload encryption, iOS 16.4+ installed-PWA support, Android Chrome)
- Cloudflare Workers Free limits (CPU, Cron Triggers, Queues availability on Free)
- the text of Loi n°2024/017 on sensitive data, consent, declaration/authorisation and the DPO

---

## 1. Checkpoint 0: release Phase 04 and prove it on a phone
Joël is present for every production step. Use a dedicated production shell (runbook).

### 1.1 Release
1. **Before anything:** a fresh encrypted backup **and** a Neon backup branch `pre-phase-04`. The Phase 03
   deploy went out without one (Phase 04 report); not again.
2. Merge `feat/phase-04a-go-live` and `feat/phase-04b-grow` (squash, in order). Confirm the `deploy` workflow
   applies migrations **0019–0035** (verify the exact range against production's migration table first)
   and that each is additive.
3. `pnpm db:seed`, `pnpm bible:seed` (if that's the current name). Then the **role grants**, done with Joël
   on the Rôles screen from one consolidated checklist that Claude Code produces from the Phase 04 report.
   Group the grants by role:
   - Trésorier, Secrétariat, Pasteur, Éditeur, Responsable de groupe, Validateur
   - the permissions: `core:validation-*`, `core:system-health`, `core:visits-read`, `campaigns:*`,
     `sundays:*`, `registrations:*`

   **Better: make system-role grants idempotent in the seed** (upsert missing grants for system roles,
   never remove a grant Joël added by hand). That ends the « grant by hand on every environment » problem.
   Write decision 0048.
4. **Privacy policy:** publish the new version covering profile details, photo, registrations, Sunday
   reports and visit counts (0033 flow, with « changement de finalité » ticked if the purposes changed: they
   did for the profile). Members see the notice.
5. Optional, only if Joël wants: `CF_ANALYTICS_TOKEN` / Analytics Engine to wake visit counts (0038).
6. Post-release smoke test on production: home, Ce dimanche, agenda, a registration form, Mon espace sign-in,
   admin « À faire », Santé green, the service worker updated (new stamp).

### 1.2 The device pass (owed since Phase 01)
On a **real mid-range Android phone** over mobile data, and an iPhone if one is available:

| Check | Pages / flows |
|---|---|
| **LCP / CLS** (Chrome remote devtools or WebPageTest on a real device) | home, Ce dimanche, article, agenda, horaires, guide, donner, sermons, méditations, registration form |
| **Preloader cost** | first visit vs repeat visit; if it holds LCP past 2.5 s, propose options (first visit per session only, shorter, or content painting under it). Joël decides: it's a brand element. |
| **Worker CPU** (Cloudflare metrics, p50/p95, hit/miss) | the same pages + `/api/search`, against 0027 thresholds |
| **TalkBack** | home, article, agenda, guide, donner, Mon espace sign-up and profile, registration |
| **Keyboard** (desktop) | editor, calendar view, publish dialog, liturgical dial, quiz, checklist, search dialog, date/time pickers |
| **Tap-to-dial / `geo:`** | Donner merchant code (`%23`), Nous trouver |
| **Calendar** | agenda feed subscribed in Google Calendar; `.ics` imported on iOS |
| **PWA** | install on Android, airplane-mode reading, update after a deploy, iOS « Ajouter à l'écran d'accueil » |
| **Rich Results Test** | production URLs for Church, NewsArticle, Event, BreadcrumbList |
| **Egress** | Neon dashboard after a few days of real use |

Record **device, OS, browser, network** for each line. Fix what fails, or list it with a severity.

### 1.3 Small carry-overs
- « Mes inscriptions » in Mon espace (done properly in §3, so just track it here)
- the per-event `.ics` on the registration confirmation page
- tell Joël about the Hébreux 8, 19 error in the parish's 2026 calendar so the Bible service can correct
  the source
- the two psalm-column warnings (2026-09-16/17)

✅ **Checkpoint 0:**
- production on Phase 04
- the grants applied (or idempotent seed, 0048)
- privacy version published
- device-pass table with verdicts and fixes
- carry-overs

Stop.

---

## 2. Checkpoint L: legal footing for member data (before building more)
Claude Code is not a lawyer. This checkpoint **prepares** the questions and documents so Joël can get a
competent answer (the council, the EEC's national office, a lawyer, or the APDP's published guidance).
It doesn't decide the law.

1. **Read the law's actual text** (official sources) on:
   - sensitive data (religious beliefs)
   - legal bases, including exemptions for religious bodies processing their own members' data
   - prior declaration or authorisation with the APDP
   - the DPO
   - transfers outside Cameroon (our database and Workers run in Frankfurt and on Cloudflare's network)

   Summarise in `docs/legal/member-data-legal-notes.md` with **quotes and article numbers**. Mark what's
   certain vs what needs an expert.
2. **Register of processing** (« registre des activités de traitement »), `docs/legal/register.md`. One
   entry per processing:
   - accounts
   - profile details
   - photo
   - groups / rosters
   - registrations
   - contact & prayer requests
   - Sunday reports (aggregates)
   - campaigns
   - visit counts
   - audit log
   - backups
   - the future communion card

   For each:
   - purpose
   - legal basis
   - categories of data and people
   - recipients (roles)
   - retention
   - security measures
   - location / transfers

   Generate the data part from the module READMEs where possible, so it doesn't drift; write the rest by
   hand.
3. **Questions for Joël to take to a competent person**, in plain French:
   - Is an APDP declaration/authorisation needed for the member database?
   - Must a DPO be designated, and who?
   - Is hosting in Frankfurt acceptable as is, or does it need safeguards or a notice?
   - Is explicit consent the right basis for membership data, or does the religious-body provision apply?
4. **Until answered, apply the safer reading:**
   - membership-related data is treated as sensitive
   - **explicit consent** for anything beyond the account itself
   - minimal staff access
   - no new sensitive category without a decision record
   - the transfer location stated in the privacy policy

✅ **Checkpoint L:** the notes, the register, the questions. Stop. Joël may answer later; the safer reading
applies meanwhile.

---

## 3. Mon espace: the member's home → **Checkpoint A**

### 3.1 Plan before building
« Mon espace » grew feature by feature (profile, consents, devices, data copy, deletion, the photo, the
Moissons page). This phase **plans it as one product**. Before code, produce a short information
architecture, `docs/product/mon-espace.md`:
- who uses it (a parishioner on a mid-range phone, often on Sunday, sometimes the diaspora)
- the **top three things** they come for. Propose: what's happening for me this week, my groups, my card.
- the navigation inside Mon espace (tabs or sections, max 5)
- what's on the first screen vs one tap away
- the empty and incomplete states
- what's offline

Show Joël a low-fidelity sketch (in `/_brand` or as screenshots of a quick prototype) **before** full build.
That's the « planned properly » that decision 0047 asked for.

### 3.2 Foundation (proposed sections; follow the agreed plan)
- **Accueil (my week):**
  - greeting
  - « Ce dimanche » (my parish Sunday, from liturgy + validated schedule)
  - **my next registrations** with their dates and the event `.ics`
  - my groups' next events and latest announcements (§4)
  - profile completeness (existing checklist)
  - the communion card tile (§5)
- **Mes inscriptions:**
  - upcoming and past (past kept until retention removes them)
  - status (confirmed / waitlist position)
  - cancel via the existing signed flow
  - add to calendar
  - registrations made **before** having an account, with the same phone/email, are **not** linked
    automatically. Offer a « relier mes inscriptions » step with a code sent through… nothing (no email,
    no SMS). So propose a staff-assisted link, or skip it. Decide with Joël.
- **Mes groupes:** groups I belong to (from `group_members`), request to join (§4), leave a group.
- **Notifications** (member side): an in-app list for members, reusing 0044/0046 (bell in the public header
  once signed in):
  - registration promoted from the waitlist
  - group announcement
  - privacy-policy change
  - the card is ready or renewed

  Mutes per kind (0046).
- **Profil & confidentialité:** the existing profile, photo, avatar choice, consents, data copy, devices,
  deletion. Reorganised, not rewritten.
- Everything **private, no-store**, never in the service worker cache (0037), FR/EN, light/dark, Storyset
  empty states, documented in `/_brand`.
- Budget: Mon espace stays a small island (report its weight). It must be usable on a 360 px phone with
  one thumb.

✅ **Checkpoint A:** the IA doc + sketch approval (first), then the built Accueil, Mes inscriptions, Mes
groupes (list), member notifications, reorganised profile. Phone screenshots. Stop.

---

## 4. Groups for members and leaders' spaces → **Checkpoint B**
Data-protection first: a roster reveals who belongs to which church group. Write decision **0049** and
update `data-protection.md` and the register **before** building.

### 4.1 Membership flow
- A member asks to join a group from its public page or from Mon espace. The request is
  `pending`.
- The group's leader(s) (*Responsable de groupe* scoped to it) or the secretariat approve or decline, with an
  optional message the member sees.
- Leaving is immediate. A leader can remove someone, with a reason kept in the audit (not shown publicly).
- `group_members` gains `status`, `requested_at`, `decided_by`, `decided_at`. Additive migration.
- Being in a group **never** makes anything public (0031 still governs public names).

### 4.2 Leader's space (admin, scoped to their group(s))
A « Mon groupe » screen in the admin, visible to a scoped *Responsable de groupe*:
- **Roster:**
  - name, avatar per 0047 rules, joined date, role in the group (titles exist), contact buttons (WhatsApp
    deep link / `tel:`) **only if the member's profile consent allows staff contact**
  - no export by default; export needs `groups:export` (dangerous, audited)
- **Requests:** pending joins, approve/decline.
- **Announcements:** short messages to the group's members (title, text, optional link/event), shown in
  their Mon espace and as a member notification. Lifecycle: draft/publish/expire. No email or SMS.
- **Our events & forms:** the group's events and registration forms (existing modules, filtered by
  `group_id`), with quick create.
- **Our page:** a link to the existing public page editor (Groups screen).
- **Small stats:** member count, joins this month, age bands only if ≥ 5 people (0047 rule).

### 4.3 Members' side
- Mes groupes shows each group's latest announcements and next events.
- A group I belong to shows a « membre » badge on its public page (visible only to me).

✅ **Checkpoint B:**
- join → approve → announcement → member notification
- leave and remove
- scope tests (a JAPE leader sees nothing of UFC)
- export audited
- decision 0049 + legal diff
- phone screenshots

Stop.

---

## 5. The carte de Sainte-Cène → **Checkpoint C**
**Don't build before the meaning is settled with the parish.** EEC parishes use such a card in their own
way: communicant status, sometimes contributions or annual stamps. **Do not invent what it means.**

### 5.1 Define (with Joël, who asks the council/secretariat), then write decision 0050
Questions to settle, in French, for Joël to take to the secretariat:
- What does the card **attest**? (e.g. « membre communiant » of the parish for year N)
- Who **issues** it, and on what basis? (confirmation record? council decision? secretariat check?)
- **Validity:** per civil year, per church year, or until revoked? Renewal process?
- Does it record **anything else** (contributions, stamps, participation)? If it records contributions,
  that's financial personal data: separate decision, and probably not now.
- **Who checks it, when?** (at the Sainte-Cène? at elections? for registrations reserved to communicants?)
- Paper card today? Should the digital one **replace** or **mirror** it?
- What's printed on it: name, photo?, member code (`memberCode()` exists), parish, year, validity,
  signature?

### 5.2 Build (according to 0050). Proposed shape
- **Issuance in the admin** (`cards:issue`, `cards:revoke`, dangerous):
  - the secretariat marks a member as eligible and issues the card for a period
  - two-person rule if 0050 asks for it (like 0041/0045)
  - revocation with a reason (audited, never shown publicly)
  - bulk issuance for the start of a year
- **In Mon espace:**
  - the card (brand green, the gentle tilt from Phase 04, reduced-motion static)
  - name, parish, member code, validity, status
  - « valide » / « expirée » / « suspendue » in words + colour + icon
  - the photo only if the member chose it (0047)
- **Verification:**
  - the card shows a **signed QR code** (HMAC or Ed25519 over member code + validity + card version,
    rotating per issuance)
  - scanning opens `/verifier/<token>`, which answers **only** « carte valide jusqu'au … » or « non
    valide », with the first name and initial and, if 0050 allows, the photo
  - **nothing else, and no account needed**
  - rate-limited, noindex, never cached publicly
  - a staff « Vérifier une carte » scanner in the admin (camera via the browser, works on a phone) for
    checks at the door
- **Offline:**
  - the card must open **without network** on Sunday morning (a known pain point with mobile data)
  - store only the card (not other private data) with the service worker under a private, explicit rule,
    or in IndexedDB from Mon espace, and with an expiry
  - offline it shows « vérifiée le … »
  - amend decision 0037 accordingly and test that **no other private page is cached**
- **Download/share:** still **no**, unless 0050 says otherwise (0047 rule).

✅ **Checkpoint C:**
- decision 0050 with the parish's answers
- issuance → card in Mon espace → QR verify (valid / expired / revoked)
- airplane mode on a real phone
- staff scanner on a phone
- audit lines

Stop.

---

## 6. Push notifications, data-rights log, wrap-up → **Checkpoint D**

### 6.1 Push: decide first (decision 0051), then build only if approved
Present Joël the trade-off:
- **For:** reminders that people actually see (Sunday, my registration tomorrow, a group announcement),
  free (Web Push + VAPID), works on Android and on iOS for an installed PWA (verify current state).
- **Against:**
  - one more consent and settings surface
  - keys to manage (VAPID secret)
  - sending costs Worker CPU (payload encryption per subscriber): measure it, and batch through a Cron or
    Queues if available on Free
  - notification fatigue

If approved:
- **opt-in only**, per kind, from Mon espace (never a prompt on page load), reusing the 0046 mute kinds
- subscriptions stored minimal (endpoint, keys, kinds, created_at, last_success)
- removed on failure (410) and with the account
- payloads carry **no personal data beyond a short title**; opening goes to the right page
- **staff side:** the existing admin notifications may also push, with the same rules
- **a send budget per day** (no spam), quiet hours (21:00–07:00 Africa/Douala) except for what Joël marks
  urgent
- tests on a real Android phone and an installed iOS PWA

### 6.2 Data-rights requests log
For people **without** an account (or by phone/in person):
- a small admin register: who asked, what (access, rectification, erasure, objection), received on,
  **legal deadline** (from the law's text, see Checkpoint L), status, what was done, closed on
- reminders through the existing notifications as the deadline nears
- retention per the register
- members keep their self-service tools (copy of my data, deletion)

### 6.3 Quality gates (before the report)
Run `release-checklist` and `owasp-security` fully, plus:
- **Privacy:**
  - every new data type in `data-protection.md` and the register
  - roster/contact visibility follows profile consent
  - verification endpoint leaks nothing beyond 0050
  - no private page in the service worker cache except the card under its explicit rule (test)
- **Security:**
  - route-table test green
  - QR tokens can't be forged or replayed past validity (tests)
  - rate limits on verify, join requests and push subscribe
  - group scope matrix extended (rosters, announcements, requests, cards if scoped)
- **Budgets:** Mon espace island weight; the public pages unchanged or better; CPU of verify and push send.
- **Accessibility:** TalkBack on Mon espace, card, verify page, leader roster; card status never colour-only.
- **E2E (manual):**
  - join → approve → announcement
  - registration appears in Mes inscriptions
  - card issue → verify → revoke → verify fails
  - offline card
  - push (if built) on a device
- `pnpm check` green.

✅ **Checkpoint D:** demo push (or the recorded « not now »), the data-rights log, the quality gates. Stop.

---

## 7. Wrap-up
1. Decision records:
   - 0048 idempotent system grants
   - 0049 group membership & rosters
   - 0050 carte de Sainte-Cène
   - 0051 push notifications
   - 0052 data-rights log
   - others as needed

   Keep `docs/decisions/README.md` **in numeric order** (it currently isn't: fix it).
2. Update:
   - `ARCHITECTURE.md`, `CLAUDE.md`
   - roadmap (mark done)
   - `navigation.md` (Mon espace sections)
   - `pages.md` (Mon espace and card signatures)
   - runbook (release checklist per phase, grants via seed, card year start, verify-at-the-door, push keys)
   - `data-protection.md` + `register.md`
   - the `new-module` skill
   - `/_brand` (Mon espace layout, card, QR, scanner, leader roster, announcement, push opt-in)
3. `STATUS.md`:
   - **trim it**: it now carries old checkpoint notes from Phases 02–04. Keep current state, production
     state, waiting-on-people, open questions, and link to the reports for history.
   - Phase 05 done, next proposal.
4. `docs/phases/PHASE_05_REPORT.md`:
   - release record
   - device-pass table
   - legal notes status
   - what was built
   - measurements
   - deviations
   - known issues
   - suggestions for Phase 06: newsletter once a domain exists, pawaPay once merchant details exist, an
     audio host if podcasts are wanted, sacrament requests after a legal answer, department tools beyond
     rosters
5. PRs:
   - after Checkpoint 0 (release, already merged)
   - `feat/phase-05a-member-home → main` after B
   - `feat/phase-05b-community → main` after D

   Each ready for review, with phone screenshots. **Merging deploys: only with Joël's OK, after a backup
   branch.**

---

## Out of scope
Newsletter and email (no domain), registering a domain, payments/pawaPay, audio hosting/podcast (0034),
sacrament requests, attendance tracking **per person** at services, a public member directory, phone/SMS
login, third-party analytics, setting `SITE_INDEXABLE=1` (Joël's, `launch.md`).

## Commit conventions
Conventional Commits scoped by module (`feat(mon-espace): …`, `feat(groups): …`, `feat(cards): …`,
`feat(push): …`, `docs(legal): …`, `chore(db): …`, `fix(a11y): …`). Migrations in their own commits,
additive only. Push at checkpoints only.

## Stop and ask Joël when
- any production step
- anything the parish must define (the card's meaning, eligibility, who verifies)
- any legal question beyond the safer reading
- a new kind of personal or sensitive data
- anything about minors
- push sending volume or CPU near limits
- a third-party domain
- a brand element changes (preloader, card look)
- docs and code disagree
- the launch itself
