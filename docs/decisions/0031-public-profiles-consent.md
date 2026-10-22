# 0031 — Names and photos of people: public only with a recorded consent
**Status:** Accepted · 2026-10-21
**Context:** Department pages and the Pastors and Council page show people. In Cameroon's Loi n°2024/017 a person's name
and photo are personal data; a parish volunteer's place on a list is not consent to publish it on the internet.
**Decision:**
1. **Consent is per person, explicit, and recorded**: an unticked box, with **who recorded it and when**
   (`consent_by`, `consent_at`). Withdrawing clears it and the name disappears at the next cache refresh (seconds).
2. **The server decides what leaves**: without consent the public API sends the **role only** — no name, no photo, no term.
   The browser never receives data it must hide. (Same rule as the liturgy's preacher names.)
3. **Roles stay public**: « Pasteur titulaire », « Anciens »… are institutional facts; the page explains the governance
   in a rich-text slot and shows role cards without names when nobody has consented.
4. **Audited**: every consent given or withdrawn has its own line in the activity log (no personal data in the line).
5. **Scoped**: a group leader edits only their own group's people; the council is managed with `story:council`.
**Consequences:** `docs/legal/data-protection.md` lists these data types. Photos used for a person are recorded as media
usages so a photo in use cannot be deleted from the library.
