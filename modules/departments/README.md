# Module `departments` — Départements

**Purpose.** One public page per group (department, committee, choir): tagline, text, photo, when they meet,
contact, audience tags, people. A filterable index and the « Où est ta place ? » quiz. Builds on core `groups`.

**Data kept.** `department_pages` (1:1 with a group), `department_people` (name, role FR/EN, optional photo,
**public consent** with who recorded it and when), `department_quiz` (questions and answer→tag mapping).
The quiz stores **nothing about visitors**: it runs in the browser.

**Public exposure.** Only published pages (`/api/departments/public*`). A person's **name and photo are sent only when
consent is recorded**; otherwise only their role. Withdrawing consent removes the name from the next cache refresh
(a few seconds). A group's approved schedule slots and latest news/events are read by the page from their own modules.

**Rights.** `departments:read`, `departments:update` and `departments:publish` (can be granted for one group:
a *Responsable de groupe* edits only their group), `departments:quiz`.

**Retention.** Kept until deleted; removing a person deletes their row. Consent changes appear in the audit trail.
