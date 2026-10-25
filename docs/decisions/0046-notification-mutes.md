# 0046 — A person can silence a kind of notification
**Status:** Accepted · 2026-10-25 (Joël)
**Context:** Notifications (0044, 0045) come in four kinds: the week's summary, Sundays to fill in, Sundays to validate, Moissons entries to validate. Someone who validates but never fills in, or who finds the summary redundant, should be able to switch a kind off without losing the others.
**Decision:**
1. **Per person and per kind**, from the gear in the bell's panel (a switch per kind, with a sentence saying what it is). Default: everything on.
2. A silenced kind is **not raised** for that person, **not shown** (existing items are hidden, not deleted), **not counted** in the badge, and **not counted in their weekly summary**. Switching it back on brings back what is still due.
3. It only affects the person who sets it; nobody can silence it for someone else, and it changes nothing about what is recorded or validated.
**Consequences:** table `notification_mutes` (migration 0033, additive; one row per person and kind, removed with the person); `PUT /api/notifications/mute`; the list answers with the kinds muted.
