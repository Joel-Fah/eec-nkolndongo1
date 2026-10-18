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
- [ ] No missing keys (`pnpm i18n:check`); FR typography correct
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

## Wrap-up
- [ ] DB migration applied to Neon main (backup branch created first)
- [ ] `STATUS.md` updated, tag `vYYYY.MM.N`
