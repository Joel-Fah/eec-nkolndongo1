# 0035 — Registrations (Inscriptions): what is collected, from whom, for how long
**Status:** PROPOSED · 2026-10-23 · **nothing is built until Joël has read this and the `data-protection.md` section it adds**
**Context:** Retreats, concerts, catechism, JAPE outings need a way to sign up. This is **new personal data** (names, phone
numbers, sometimes children's first names). The data-protection law of Cameroon (Loi n°2024/017) asks for explicit consent,
minimisation, a retention period and a way to withdraw. A minor is involved: this needs an explicit decision.
**Proposal:**
1. **A form per activity** (attached to an event, or standalone for things like catechism enrolment), with: opening and closing
   dates, a capacity, a waitlist on/off, and who may register (anyone, or signed-in members only).
2. **Fields.** Always: **name**, **a phone number or an e-mail** (at least one, to reach the person), **number of people**.
   Optional, chosen by staff per form from a short list: the group, an age band, a short text, a single choice, several
   choices, yes/no. **The builder offers no free « sensitive » question** (health, origin, religion beyond the obvious context,
   political views, finances): not available, and the help text says why. Free text is limited to 300 characters and labelled
   « n’écrivez pas d’informations de santé ».
3. **Children.** For an activity for minors the **registrant must be the parent or guardian** (a required, unticked box
   « Je suis le parent ou le tuteur légal »). The child is recorded as a **first name and an age band only** (for example
   6–9 ans), never a surname, birth date, school or photo. A guardian can register several children on one form.
4. **Consent.** One unticked box per registration: « J’accepte que mes informations servent à cette inscription et à me
   prévenir en cas de changement », stored with the policy version and the time. No marketing use, no sharing, no newsletter.
5. **Public flow.** Works without JavaScript; honeypot + a server-signed timestamp + a rate limit (as the contact form).
   Confirmation page with a **registration code**, the event's `.ics`, a WhatsApp share of the event, and **« Annuler mon
   inscription »** through a **signed, expiring link** (valid until the event; no account needed). Signed-in members also see
   « Mes inscriptions » in Mon espace (linked by their account only if they registered while signed in).
6. **Capacity and waitlist.** At capacity: a waitlist with a position. A cancellation **promotes the next person**, and the
   notice to them goes through the **outbox** (decision 0019: nobody is e-mailed automatically; the secretariat relays it by
   phone or WhatsApp). The admin shows « à prévenir ». **The outbox message holds the first name and the phone only**, and is
   deleted by the existing 90-day outbox retention.
7. **Staff access.** `registrations:read` (see lists), `registrations:manage` (add by hand, cancel, check in),
   `registrations:export` (CSV, **dangerous**, audited with the number of rows, never the content). Rights can be limited to a
   group (a JAPE leader sees JAPE forms only). **Check-in mode** (for a phone, one-handed) shows names and a « présent »
   button, not phone numbers.
8. **Retention.** Personal data of a registration is deleted **6 months after the event's date** (the table in
   `data-protection.md` already says so), and in any case **12 months after the form closed** (hard cap). A form without a
   date is capped at 12 months after it closed. **Attendance counts survive**, anonymised (totals per form: registered,
   waitlisted, present), for the parish's records. The daily retention job does this and logs it.
9. **Withdrawal and access.** A person can cancel with their link; staff can delete a registration on request (audited, no
   content in the log). Someone who asks for a copy of their data gets it from the secretariat (the form's fields only).
10. **Not collected, ever:** a payment, an amount, an ID document, an address, a photo, a surname for a child, any field about
    health, origin, religion or finances.
**To decide with Joël (before building):**
- Is a phone number or an e-mail enough, or must a phone always be required (the parish reaches people by WhatsApp)?
- The adult age limit and the age bands (for example 0–5, 6–9, 10–13, 14–17).
- Is 6 months after the event right, with a 12-month hard cap, or shorter?
- « Members only » forms: keep, or leave out for now?
- Who may export the CSV (suggest: super admin and secretariat only).
**Consequences if accepted:** new tables (`registration_forms`, `registrations`, `registration_people`, `registration_counts`),
new permissions, three public mutations in the route-table test (submit, cancel, token), retention job extended and tested,
`data-protection.md` and the privacy policy updated (a new policy version), help guides for staff.
