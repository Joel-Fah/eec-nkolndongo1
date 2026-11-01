# Module `rights` — Demandes sur les données

**Purpose.** A small log (decision 0052) of requests to see, correct, erase or object to the use of one's data, made by people **without an account** or by phone, in person or in writing:
who asked, what, when it was received, the deadline to answer, what was done, when it was closed. Members use their own tools in Mon espace (copy of my data, deletion).

**Data kept.** `rights_requests`: kind, the person's name, a way to answer (optional), the channel, received on, due on, status, a few words on what was done, closed on, who handled it.

**Why each field.** To answer on time and to be able to show that we did. The outcome is a few words, never the personal data itself.

**Exposure.** Staff only: `rights:read`, `rights:handle`, `rights:delete` (dangerous). The activity log records that a request was noted or changed and its kind, never who.

**Deadline.** `DEADLINE_DAYS` = 30 days from reception: the safer, shorter reading, **to confirm against the text of Loi n°2024/017** (Checkpoint L). A notification (« À traiter ») warns the people who may read the log when a request is overdue or due within 5 days.

**Retention.** Closed requests are erased 24 months after they were closed (daily job, `apps/api/src/retention.ts`; duration to confirm with the legal notes).

**Owners.** Secrétariat.
