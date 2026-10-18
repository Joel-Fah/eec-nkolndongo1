# 0001 — Custom build instead of WordPress
**Status:** Accepted · 2026-10-19
**Context:** The research draft recommended WordPress + church themes + plugins. We want a distinctive,
story-driven, very light UI; free hosting; a bilingual admin with fine-grained roles; and an AI-assisted
single developer.
**Decision:** Build a custom TypeScript monorepo (see ARCHITECTURE.md).
**Consequences:** Full design control, free hosting, small payloads. We own maintenance and must build
admin features ourselves — mitigated by the module system and skills.
