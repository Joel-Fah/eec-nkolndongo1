# 0002 — Astro for the public site
**Status:** Accepted · 2026-10-19
**Context:** Public pages must be fast on 3G/4G yet richly animated in places; SEO matters; FR/EN.
**Decision:** Astro, static by default, on-demand rendering + edge cache for live content, React islands
only where interactivity needs it, built-in i18n routing and View Transitions.
**Consequences:** Minimal JS by default. Content updates purge cache rather than rebuild.
