# 0014 — Paraglide JS for i18n messages
**Status:** Accepted · 2026-10-19
**Context:** Both the public site (Astro) and the admin (React) are bilingual, French first. We want one
message source, type-safe keys, and no runtime dictionary shipped to visitors.
**Decision:** Paraglide JS 2 (inlang). Messages live in `packages/i18n/messages/{fr,en}.json` (FR is the
base locale) and compile to one tree-shakeable function per message (`packages/i18n/src/paraglide`,
generated, gitignored, with `.d.ts`).
- **Astro owns the URLs** (built-in i18n routing, `/fr/…` and `/en/…`, both prefixed). Pages call messages
  with an **explicit locale** — `const t = useT(Astro.currentLocale)` — so prerendering never depends on
  global locale state, and no Paraglide middleware is needed.
- `/` is the only on-demand route: it reads `Accept-Language` and redirects (302, `Vary: Accept-Language`).
- **Admin** uses a small provider (`apps/admin/src/lib/locale.tsx`) over the same `createT`: saved choice →
  browser language → French, persisted in `localStorage`. It reuses `pickLocale` and the same messages.
- `createT(locale)` applies `frTypo()` to French output, so messages are written with plain spaces
  (`"Bienvenue !"`) and rendered with correct no-break spaces.
- A unit test fails if FR and EN key sets differ (our `i18n:check`).
**Consequences:** Zero i18n JS on static pages; messages used in client scripts are bundled per message
only. Keys are `area.element` paths (accessed as `t('nav.discover')`). If Paraglide's Astro story changes,
only `apps/web/src/lib/i18n.ts` depends on it.
