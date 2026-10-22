# 0029 — Events: recurrence, exceptions and calendar files
**Status:** Accepted · 2026-10-21
**Context:** The agenda needs events that repeat (every Sunday, the 1st Saturday), with single dates cancelled or moved,
and files that Google Calendar and Apple Calendar accept, including a feed people can subscribe to. Parishioners use
mid-range phones: no heavy calendar library on the site.
**Decision:**
1. **A small structured subset, not free RRULE text.** Weekly (chosen weekdays, every N weeks), monthly on the Nth or last
   weekday, monthly on a day number; ended by a date or a count. Exceptions are `cancelled` or `moved` per original date,
   with an optional public note. Stored as JSON on the event (`recurrence`, `exceptions`).
2. **Expanded on the server** for a requested window (at most 550 days) by pure, tested code in `@eec/core`
   (`expandOccurrences`). Arithmetic is in the event's own time zone via `Intl` (Africa/Douala has no DST; nothing assumes it).
   A repeating event keeps the local time of day of its first occurrence; `COUNT` counts cancelled dates too (as in RFC 5545).
3. **RFC 5545 files** from our own writer (`buildIcs`, no dependency): CRLF, 75-octet folding on UTF-8 boundaries, TEXT
   escaping, UID + DTSTAMP, local times with `TZID` and a fixed-offset `VTIMEZONE` (so « every Sunday » stays on Sunday),
   `UNTIL` in UTC, `COUNT` or `UNTIL` never both, cancelled and moved dates as `EXDATE`, moved ones also as a
   `RECURRENCE-ID` override. Feeds carry `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` of one hour and are edge-cached.
4. **Public**: list by default (this week / this month / later, next 100 days), a month view without JavaScript, group
   filter; cancelled occurrences stay visible, struck through, with their note. Per event: `.ics` and a Google Calendar link
   (a plain link: nothing is loaded from Google until clicked).
**Consequences:** Editors cannot write arbitrary RRULEs (by design); unusual patterns are two events. Tests cover the
expansion (weekly, nth weekday, day 31, late-evening events, exceptions, window cap) and the file (escaping, folding,
EXDATE, overrides, all-day). **Still to do by hand:** import a feed in Google Calendar and iOS (needs a public URL and a
device; the writer follows the RFC rules above).
