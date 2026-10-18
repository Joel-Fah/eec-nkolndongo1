# Data protection — Loi n°2024/017 du 23 décembre 2024 (Cameroun)

> Not legal advice. Have the final texts reviewed by someone competent before launch.
> The compliance grace period ended in June 2026 → we comply **from day one**.

## Principles we implement
| Obligation | Implementation |
|---|---|
| Lawfulness & explicit consent | Unticked consent checkboxes on every form; consent stored with timestamp + policy version |
| Minimisation | Each module's README lists the fields it stores and why; no optional field without a purpose |
| Retention & destruction | Retention per data type (table below); scheduled job deletes/anonymises expired data |
| Security & confidentiality | TLS everywhere, least-privilege roles, audit log, secrets in Cloudflare, Neon access restricted |
| Data subject rights | "Mon espace": view, edit, export (JSON), delete account; admin log of requests |
| Breach notification | Incident procedure in `docs/ops/` (notify APDP + affected people) |
| Non-discrimination | No collection of ethnic origin, region, political opinion |
| DPO | Council to designate a contact person for data questions |

## Initial retention proposals (to validate)
| Data | Retention |
|---|---|
| Contact form messages | 12 months after closure |
| Member account | While active; deleted 30 days after deletion request |
| Event registrations | 6 months after the event |
| Newsletter subscription | Until unsubscribe |
| Audit log | 24 months |
| Server logs | 30 days |

## Explicitly out of scope until a decision record exists
Baptism/marriage registers, counselling/délivrance notes, health information, minors' data beyond
what a parent provides for a specific activity.

## Pages to ship
- Politique de confidentialité (draft in `docs/research/`, to rewrite)
- Mentions légales
- Cookie notice: none needed if we use no tracking cookies (only essential session cookies) — keep it that way.
