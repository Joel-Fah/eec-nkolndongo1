---
name: i18n-content
description: Write or edit any user-facing text (UI strings, page copy, emails, SEO metadata) for EEC Nkolndongo 1 in French first then English, with the right tone and church vocabulary. Use whenever adding or changing copy.
---

# i18n & content

## Rules
- **French first**, then English. Keys in `packages/i18n` (shared) or `modules/<id>/i18n/` (module). Never hard-code text.
- Key naming: `module.screen.element` (`events.list.empty.title`).
- Use ICU plurals/variables; format dates (`fr-CM` / `en-GB`), times 24h (`09h00` in FR), currency XAF (`5 000 FCFA`).
- French typography: thin no-break space before `; ! ?`, no-break space before `:` and inside « ».
  Use the `frTypo()` helper; curly apostrophe `’`.
- Slugs are localised; keep a mapping for the language switcher.

## Tone
Warm, hopeful, simple, respectful — never preachy or salesy. Short sentences. Address visitors with
**vous**; JAPE/youth pages may use a lighter tone but stay respectful. A little smile is welcome in
microcopy (empty states, 404), never in sacraments or mourning content.

## Vocabulary (EEC usage)
Culte · Sainte-Cène · Conseil paroissial · Ancien(ne) d'Église · Diacre · Catéchiste · Pasteur titulaire ·
JAPE · Union des Femmes (UFC) · Fête des Moissons · Paroisse / District / Région synodale · offrande · dîme.
English: keep French proper names (JAPE, Fête des Moissons) with a short gloss the first time.

## Truth
Facts about the parish (times, names, dates, history) must come from validated content
(`docs/content/README.md`). If missing, use a clearly marked placeholder `[À VALIDER: …]` — never invent.
