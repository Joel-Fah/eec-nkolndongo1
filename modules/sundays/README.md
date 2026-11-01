# Module `sundays` — Bilan du dimanche

**Purpose.** Attendance and offerings of each Sunday and special day, as **aggregates**, with proposed figures validated by the secretariat or treasurer, and trends (decisions 0043, 0044, 0045). Nothing here is ever public.

**Data kept.** `sunday_reports` (date, service, men / women / children counts, kind, an internal note, who entered and when, closing) and `sunday_offerings` (purpose, amount, optional group or campaign). **No name, no donor, no per-person attendance.**

**Why each field.** Counts and amounts: to understand the life of the parish and report to the Conseil. Who entered and when: accountability.

**Exposure.** Admin only: `sundays:read|attendance|offerings|propose|close|export` (group leaders see only their group's lines). The CSV export is for the super admin and the secretariat.

**Retention.** Kept (aggregates, no personal data).

**Owners.** Secrétariat (attendance, closing), trésorier (offerings).
