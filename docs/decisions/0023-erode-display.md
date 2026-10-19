# 0023 — Erode replaces Fraunces for headings
**Status:** Accepted · 2026-10-19 · supersedes the display-font part of 0015
**Context:** With the site moving to a sleeker, more modern direction, Joël chose Erode (Fontshare) for
headings instead of Fraunces.
**Decision:** Headings, lockups and big numbers use **Erode** (variable, weights 300–700, roman + italic).
Like Switzer, it is under the ITF Free Font License: fetched unmodified by `pnpm fonts:fetch`, self-hosted,
never committed, never subset. Metric-matched fallbacks: Georgia (desktop), Noto Serif (Android).
**Consequences:** The committed Fraunces files and `scripts/subset-fraunces.py` are removed. Erode's variable
roman is 31 KB (Fraunces subset: 35 KB). Erode has no U+202F (narrow no-break space); the French spacing
helper keeps using U+00A0, as before.
