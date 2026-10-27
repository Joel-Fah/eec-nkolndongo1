# Module `registrations` — Inscriptions

**Purpose.** A registration form per activity (retreat, concert, outing), with a waitlist, check-in at the door and automatic deletion (decision 0035). A signed-in member can see and cancel their own (Mon espace).

**Data kept.** `registration_forms` (title, event day, capacity, audience, optional questions), `registrations` (code, status, name, phone, WhatsApp, optional e-mail, party size, answers, guardian confirmation, the time of consent and the policy version, the account if signed in, check-in and notification times) and `registration_people` (a child's first name and age band). `registration_counts`: anonymous totals per form, kept after the people are erased.

**Why each field.** Name and phone: to reach the person (a place freed, a change). Party size and answers: to organise the activity. Child's first name and age band: for activities for minors, with a parent's confirmation. Consent time and version: proof of agreement. No question may ask about health, origin, religion, politics or money.

**Exposure.** Admin: `registrations:read|edit|manage` (group-scoped); the CSV export (`registrations:export`) is for the super admin and the secretariat and is audited. The check-in list shows no phone number. A member sees only their own.

**Retention.** The people (and children, by cascade) are erased 6 months after the event, at most 12 months after the form closed (daily job, `apps/api/src/retention.ts`); the anonymous totals stay.

**Owners.** Secrétariat; group leaders for their group's forms.
