# Module `communion` — Cartes de Sainte-Cène

**Purpose.** The digital card of a communicant (decision 0050): proposed by the secretariat, approved by a second person, signed month by month by the
Elders, shown in Mon espace with a signed QR code that anyone can check (« valide jusqu'au … » or « non valide »).

**Data kept.** `communion_cards` (person, status, version, last day of validity, who proposed and approved), `communion_visas` (card, month, who signed),
`communion_excuses` (card, month: the member's word, no reason), `communion_fees` (expected amount by age band or group), `communion_contributions` (card, month,
amount received, who noted it). On `profiles`: the member's own declaration (baptised, confirmed: only with the `profile` consent) and who confirmed the baptism
from the register and when. Religious-belief data.

**Why each field.** The card and its version: what is valid, and an old QR code stops working when a card is renewed. Visa and excuse: the monthly Holy Supper
and the streak. Fees and contributions: the Elders' register; the member only sees « expected », never a balance. Sacrament confirmation: a card is for someone whose
baptism the parish confirmed.

**Exposure.** The member sees their own card. The Elders, the secretariat, the pasteur and the treasurer see the cards (not the profile). The contributions register:
the Elders, the secretariat and the treasurer. The public check shows a first name and an initial and nothing else, no account needed, rate-limited, never cached.

**Retention.** Visas, excuses and contributions are kept while the account exists and 12 months after it is closed or the person leaves (decision 0050), then erased
(daily job). A withdrawn card is kept as history for the same time. Everything goes with a deleted account.

**Rights.** `communion:read`, `issue`, `approve` (dangerous), `suspend` (dangerous), `visa`, `register-read`, `register-write`, `fees`, `verify`.

**Cross-module data.** People, profiles, groups and consents are read by table name through `@eec/db/schema`; this module imports no other module.

**Owners.** Secretariat and pasteur (cards), Anciens d'Église (visas, register), treasurer (fees).
