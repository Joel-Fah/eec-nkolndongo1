# 0008 — Brevo for email (Zoho dropped)
**Status:** Accepted · 2026-10-19
**Context:** Zoho Mail Forever Free excludes IMAP/POP and doesn't officially offer SMTP sending for apps.
**Decision:** Drop Zoho. Use Brevo (free tier) for transactional mail and newsletters. Templates built with
React Email (`packages/emails`). Activated once a domain exists (SPF/DKIM/DMARC required).
**Consequences:** Until a domain exists, no outbound email; contact messages land in the admin inbox.
