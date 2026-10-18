---
name: email-templates
description: Design and build HTML emails (transactional, newsletter) for EEC Nkolndongo 1 with React Email following email-client constraints, FR/EN and brand styling. Use whenever an email is created or changed.
---

# Email templates

Provider: Brevo (see decision 0008). Templates in `packages/emails` (React Email), rendered to HTML +
plain text at send time.

## Email HTML rules (clients are not browsers)
- Table-based layout via React Email components (`Container`, `Section`, `Row`, `Column`); max width 600px.
- **Inline styles** (React Email does this); no external CSS, no flex/grid reliance, no JS, no web fonts
  reliance — font stack: `Switzer, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`.
- Images: absolute HTTPS URLs on R2, explicit `width`/`height`, meaningful `alt`; never image-only emails.
- Rounded corners degrade gracefully (Outlook ignores `border-radius` — design still works square).
- Dark mode: test that the logo has a light-bg-safe and dark-bg-safe version; avoid pure white text on transparent PNGs.
- Bulletproof buttons (padded `<a>` in a table cell), ≥ 44px tall.
- Preheader text set; subject ≤ 50 chars; FR/EN from the recipient's locale.
- Always include: parish name, address, why they received it, unsubscribe link (newsletter), privacy link.
- Plain-text version always generated.

## Process
1. Write copy FR first (`i18n-content` skill), then EN.
2. Build with shared `EmailLayout` (header lockup, footer).
3. Preview with `pnpm email:dev`; test in Gmail (web + Android), Outlook, Apple Mail; check spam score.
4. Never put personal data beyond what the email needs.
