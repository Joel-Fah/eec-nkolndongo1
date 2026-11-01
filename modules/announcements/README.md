# Module `announcements` — Annonces de groupe

**Purpose.** Short messages from a group's leaders to the members of that group (decision 0049): title, text, optional link; draft → published → expired.
Publishing raises a `group_announcement` notification for each member of the group and shows the message in Mon espace › Groupes. No e-mail, no SMS.

**Data kept.** `announcements_items` (group, French and optional English title and text, optional link, state, publish and expiry dates, author). The notifications
it raises live in `notifications` (one per member and announcement, removed with the person).

**Why each field.** Group: who may read it. Text: what to tell. Dates: when it appears and stops appearing. Author: accountability (audit).

**Exposure.** Only the members of the group (their Mon espace) and the group's leaders / the secretariat. Nothing is public. A group's member list is never part of an announcement.

**Retention.** An expired announcement is erased 12 months after it expired (daily job, `apps/api/src/retention.ts`); a deleted group takes its announcements with it.

**Rights.** `announcements:read`, `announcements:edit`, `announcements:publish`, all group-scoped (a leader of one group never sees another's).

**Cross-module data.** Members and notifications are read and written by table name through `@eec/db/schema`; this module imports no other module.

**Owners.** Group leaders (their group), secretariat (all).
