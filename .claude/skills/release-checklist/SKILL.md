---
name: release-checklist
description: Run before deploying a milestone or release of EEC Nkolndongo 1 - performance budget, accessibility, i18n, themes, privacy, security and docs checks. Use when preparing a release or when asked to audit quality.
---

# Release checklist

Run locally / manually (CI stays frugal — `docs/ops/ci-cd.md`).

## Performance (mobile, throttled 4G)
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility 100, Best practices ≥ 95, SEO ≥ 95 on Accueil, Notre histoire, Actualités, Agenda, Donner
- [ ] JS ≤ 100 KB gz per page; first load ≤ 250 KB excluding lazy media; LCP < 2.5 s; CLS < 0.05
- [ ] No third-party requests on load; fonts subset + preloaded
- [ ] Save-Data mode verified

## Accessibility
- [ ] Keyboard pass on nav, dropdowns, dialogs, forms
- [ ] Screen reader smoke test (TalkBack on Android)
- [ ] Reduced motion pass; contrast in both themes

## i18n & themes
- [ ] No missing keys (`pnpm check` (it compiles the messages; a missing key fails the typecheck)); FR typography correct
- [ ] Language switcher keeps the equivalent page
- [ ] Light and dark reviewed on every changed page

## Content & privacy
- [ ] No `À VALIDER` / placeholder text in shipped pages
- [ ] Consent boxes unticked; privacy policy version bumped if data use changed
- [ ] New personal data fields documented in module README + retention set

## Security
- [ ] Every new API route has Zod validation + `requirePermission`
- [ ] Secrets only in Cloudflare/GitHub secrets; `git grep` for keys is clean
- [ ] Dependencies audited (`pnpm audit`)
- [ ] Run the `owasp-security` skill on everything that changed (routes, uploads, personal data, third-party calls)

## Wrap-up
- [ ] DB migration applied to Neon main (backup branch created first)
- [ ] `STATUS.md` updated, tag `vYYYY.MM.N`

## Release and real devices (Phase 05)
- [ ] Neon backup branch **and** a working backup (the `backup` workflow green) before merging to `main`
- [ ] `pnpm db:seed` after the deploy (grants are offered by the seed, decision 0048); `docs/ops/release-phase-04.md` for what no role holds
- [ ] Privacy policy published when the purposes changed (« changement de finalité »)
- [ ] Post-release smoke test and the device pass (`docs/ops/device-pass.md`): LCP/CLS, preloader first vs repeat visit, Worker CPU, TalkBack, keyboard, tap-to-dial, `.ics`, PWA install/offline/update, Rich Results, Neon egress
- [ ] The service worker's new stamp is live and no private page was cached
