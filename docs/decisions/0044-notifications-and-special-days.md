# 0044 — In-app notifications, and reports on days that are not Sundays
**Status:** Accepted · 2026-10-25 (Joël: yes to special days, labelled; a reminder bell; notifications with deep links, grouped by week)
**Context:** A Sunday report is easy to forget, and the parish also meets on days that are not Sundays (Noël, Vendredi saint…). The admin
had no place to tell a person what is waiting for them.
**Decision:**
1. **Any real day can be reported** (amends 0043). A Sunday needs no name. **Any other day is a special day and must be named** before
   attendance or offerings are entered (server: `label_required`); the name shows on its card and sheet. Known church days (Nouvel An,
   Vendredi saint, Ascension, Noël) are only *suggested* as one-click names; no service is ever assumed. The home shortcut, the dashboard
   « Dimanche dernier » card and the « Sunday before » comparison stay Sunday-only.
2. **Notifications** are a platform table (`notifications`, migration 0031, additive): one row per person and per thing to do, unique on
   `(user, kind, ref)`. A row holds a **kind and parameters, never text** (the screen writes it in the person's language), a **deep link**
   (`/m/sundays#2026-10-18`), and the **Monday of its week** (the grouping). It can be read, hidden, and is **resolved by itself** when the
   thing is done. No personal data beyond the owner; no amounts or counts.
3. **Reminders are worked out when the list is read** (no scheduler to run or pay for): the last four Sundays before today that still lack
   attendance (for people who may enter it) or offerings (for those who may enter them); closed Sundays are done; only Sundays since the
   account existed; a switched-off module raises nothing. Same style as « À faire »: other modules' tables are read by name.
4. **The bell** sits in the top bar (before Help, Language, Theme): unread count, Non lues / Toutes, groups by week, deep link on click,
   « Tout marquer comme lu ».
**Not now (options):** browser push on the installed app (needs consent and a push service), an email digest through the outbox, a
per-person mute, reminders for validators (campaign entries waiting) and for sermons or bulletins without content, a scheduled Monday
reminder. Each is additive: a new `kind` and, for push or email, a new decision.
**Consequences:** table `notifications`; API `/api/notifications` (list, read, dismiss); rules tested in `reminders.test.ts`; e2e checks;
brand entry; help guide updated.

**Amended by 0045:** reminders for validators (proposed Sunday figures, Moissons entries) and a weekly summary were added; in-app only.
