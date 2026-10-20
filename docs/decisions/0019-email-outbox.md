# 0019 — No domain, no email: an outbox the secretariat relays
**Status:** Accepted · 2026-10-20
**Context:** Brevo (0008) needs a sending domain; we have none yet. Flows that normally email someone —
staff invitations, password resets — still have to work.
**Decision:** Nothing is emailed for now.
- **Staff invitations and staff resets are links**: an admin creates them in the admin (single use; 72 h for
  an invitation, 2 h for a reset; only a SHA-256 of the token is stored) and hands them over by WhatsApp or
  in person. No email involved.
- **Everything else that would be emailed** (a member's reset request, later notifications) is written to
  `mail_outbox` (recipient, template, locale, payload, status). People with `core:system-outbox`
  (Secrétariat, super admin) see it in **Boîte d'envoi**, pass the message on themselves, and mark it
  *transmis* or *écarté*; both are audited.
- When a domain exists, a Brevo transport takes over behind the same interface; the outbox stays as a
  fallback and an audit of what was sent.
**Consequences:** No mail infrastructure, no cost, no spam-folder problems. The secretariat has a small
manual task; the admin help text says so plainly. Outbox rows are kept 90 days (retention job).
