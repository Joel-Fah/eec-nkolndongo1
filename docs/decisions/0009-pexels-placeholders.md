# 0009 — Curated Pexels placeholders, self-hosted
**Status:** Accepted · 2026-10-19
**Context:** Real photos will arrive late. The Pexels API has no "exclude people" filter, requires visible
attribution, and is rate-limited (200 req/h).
**Decision:** A one-off curation script queries themed searches; each candidate is reviewed (visually) to
exclude people and off-tone images; approved images are optimised and stored in R2 with photographer
credits. The live site never calls the Pexels API.
**Consequences:** Consistent, fast imagery; a credits page/line lists Pexels and photographers; every
placeholder is tracked for replacement by real photos.
