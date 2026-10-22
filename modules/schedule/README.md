# Module `schedule` — Cultes et horaires

**Purpose.** The weekly rhythm (services, studies, prayers, office hours) and one-off changes (cancelled, changed time,
extra gathering). Feeds « Ce dimanche », the week view, and a per-slot calendar file. `nextService()` lives in `@eec/core`.

**Data kept.** `schedule_slots` (label, weekday, times, place, optional group, **validated** flag with who approved and
when) and `schedule_exceptions`. **No personal data.**

**Public exposure.** Only **approved** slots (`/api/schedule/public*`); with none approved the page keeps its
« bientôt » text. Editing an approved slot takes its approval away unless the editor may approve.

**Rights.** `schedule:read`, `schedule:update`, `schedule:validate`.

**Retention.** Kept until deleted; exceptions in the past are ignored by the public API.
