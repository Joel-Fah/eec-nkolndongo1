# Module `contact` — Messages

**Purpose.** The public contact form and the team's inbox (new / in progress / handled, assigned, internal notes, reply
through WhatsApp, `mailto:` or `tel:` links — we send no email).

**Data kept.** `contact_messages` (name, email or phone, category, message, optional subject, status, assignee, the time the
visitor ticked the consent box) and `contact_notes`. **No IP address is stored**: only a salted hash is used, as a
rate-limit key that expires within a day.

**Prayer requests** (category « Prière ») are flagged sensitive: read only with `contact:read-sensitive`, never exported,
shorter retention.

**Anti-spam without third parties:** honeypot field, minimum fill time, per-address rate limit, length limits. A captcha
(third-party) only if spam proves real, and only after asking.

**Rights.** `contact:read`, `contact:read-sensitive`, `contact:handle`, `contact:delete`.

**Retention** (daily job, `apps/api/src/retention.ts`): 12 months after « handled » (at most 24 months after receipt);
prayer requests 3 months after « handled » (at most 6 months after receipt).
