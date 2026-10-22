# Module `events` — Agenda

**Purpose.** Events, one-off or repeating (weekly, monthly on the Nth weekday or day), with cancelled or moved dates,
`.ics` files and a subscribable feed (decision 0029). A month calendar in the admin, a list and month view on the site.

**Data kept.** Table `events_items` (titles, descriptions, start/end, time zone, recurrence and exceptions as JSON,
place text, optional https registration link, cover, group); shared revisions. **No personal data about parishioners.**

**Public exposure.** Cached JSON `/api/events/public*`, pages under `/fr/agenda/evenements/`, calendar feeds
`/fr/agenda/calendrier.ics[?groupe=key]`, `.ics` per event.

**Rights.** `events:read/edit/publish/delete` (delete is sensitive); all can be granted for one group.

**Retention.** Kept until archived or deleted.
