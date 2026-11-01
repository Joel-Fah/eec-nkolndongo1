# Device pass and post-release smoke test

The real-phone checks owed since Phase 01. Do them on a **real mid-range Android phone over mobile data** (and an iPhone if one is available). For every line record
**device, OS, browser, network**, a **verdict** (✅ ok · ⚠️ minor · ❌ fails) and a **severity** for anything that is not ok (high: blocks a task or hurts accessibility · medium: slow or awkward · low: cosmetic).
Production URL: `https://eec-nkolndongo1.joelfah2003.workers.dev` (noindex until launch).

**Record sheet header** — Device: ______ · Android/iOS version: ______ · Browser + version: ______ · Network (4G/3G, operator): ______ · Date: ______ · Tester: ______

## 1. Post-release smoke test (5 minutes, any device)
| # | Check | How | Result |
|---|---|---|---|
| 1 | Home loads | `/fr/` opens, no error, the preloader ends | |
| 2 | Ce dimanche | `/fr/` → Ce dimanche shows this Sunday | |
| 3 | Agenda | events list, month view, a date-range pick with the date picker | |
| 4 | A registration form | open one, fill it (do not submit on production unless it is a test form) | |
| 5 | Mon espace sign-in | sign in, the header shows your avatar, sign out, the avatar is gone after a reload | |
| 6 | Admin « À faire » | `/admin/` home loads, the bell opens | |
| 7 | Santé | admin → Santé is green (backup mark present after the backup workflow works) | |
| 8 | Service worker | DevTools → Application → Service Workers: the new build stamp; or visit twice and open `/fr/hors-ligne/` offline | |

## 2. The device pass
| Check | Pages / flows | How to measure | Device · OS · Browser · Network | Verdict | Severity · note |
|---|---|---|---|---|---|
| **LCP / CLS** | home, Ce dimanche, an article, agenda, horaires, a guide, donner, sermons, méditations, a registration form | Chrome on the phone with remote debugging (`chrome://inspect` from a laptop) → Lighthouse (mobile, simulated 4G) or Performance panel; or WebPageTest on a real device. Targets: LCP < 2.5 s, CLS < 0.05 | | | |
| **Preloader cost** | first visit vs repeat visit of the home | Clear site data, load the home (first visit), then reload (repeat). Note the LCP both times. If the first visit is above 2.5 s because of the preloader, the options are: first visit per session only, shorter, or painting the content under it. **Joël decides: it is a brand element.** | | | |
| **Worker CPU** | the same pages + `/api/search` | Cloudflare dashboard → Workers & Pages → `eec-nkolndongo1` → Metrics: CPU time p50 / p99, cache hit vs miss, over the last day. Compare with the thresholds in decision 0027 (≈ 10 ms on the Free plan) | | | |
| **TalkBack** (Android) | home, an article, agenda, a guide, donner, Mon espace (sign-up and profile), a registration | Settings → Accessibility → TalkBack. Swipe through: headings in order, every button named, focus visible, forms announce their errors, the date picker is operable | | | |
| **Keyboard** (desktop) | editor, calendar view, publish dialog, liturgical dial, departments quiz, guide checklist, search dialog, **date and time pickers** (arrows, PageUp/Down, Home/End, Esc) | Unplug the mouse. Tab order logical, focus ring visible, Esc closes dialogs and returns focus | | | |
| **Tap-to-dial / `geo:`** | Donner (the merchant code with `%23`), Nous trouver | Tap the number: the dialler opens with the full code including `#`; tap the address: the maps app opens | | | |
| **Calendar** | the agenda feed in Google Calendar; a `.ics` on iOS | Add the feed URL in Google Calendar (« From URL »); open an event's `.ics` on an iPhone and add it | | | |
| **PWA** | install on Android, airplane-mode reading, update after a deploy, iOS « Add to Home Screen » | Chrome menu → Install app; visit 3 pages; airplane mode; open them; open a page you did not visit (offline page lists the saved ones); after the next deploy confirm the old version is replaced; Safari → Share → Add to Home Screen | | | |
| **Rich Results Test** | production URLs for Church (home), NewsArticle, Event, BreadcrumbList | https://search.google.com/test/rich-results — paste each production URL (the site is noindex but the test still reads it) | | | |
| **Egress** | Neon dashboard after a few days of real use | Neon console → project → Monitoring: data transfer / egress against the plan limit | | | |

## 3. What to do with the results
- ✅ nothing. ⚠️ list it with its severity in `STATUS.md` → open questions. ❌ tell Claude Code: it is fixed, or listed with its severity if the fix is not small.
- Send the filled sheet (a photo or the text); the **verdict table goes into `docs/phases/PHASE_05_REPORT.md`** as the device-pass record.
