# 0032 — Bible translations: public domain only
**Status:** Accepted · 2026-10-21
**Context:** The site shows verses (home, sign-in, liturgy pages). The first set used Parole de Vie and the
Easy-to-Read Version, which are under copyright: quoting them needs the publishers' terms checked.
**Decision:** Only public-domain texts for now: **Louis Segond 1910 (LSG)** in French and the **World English Bible
(WEB)** in English. The abbreviation (LSG / WEB) is shown next to every reference. Another translation is added
only after the parish confirms permission in writing and the terms are recorded here. Verses are typed once in
`packages/i18n` (or stored with their reference in the database) and must match the source text exactly.
**Consequences:** Wording is more formal than PDV/ETR. WEB renders the divine name as « Yahweh ». The four sign-in
verses and the home verse were replaced; the texts should be checked once against a printed or official copy.
Members may choose a version later, among those that are permitted.
