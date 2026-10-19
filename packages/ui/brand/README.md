# Brand files

The EEC mark belongs to the Église Évangélique du Cameroun — not covered by the repository licence.
Redrawn from the official PNG (method: `scripts/brand-trace/README.md`). **Never alter its shapes or
proportions.** Colours are the official ones; only the monochrome versions use another colour.

| File | Use |
|---|---|
| `mark-full.svg` | Mark with the arc text « Eglise Evangélique du Cameroun ». **≥ 200 px tall** on screen (the arc text is unreadable below). |
| `mark.svg` | Mark without the arc text — header, favicon source, small sizes. **≥ 24 px tall.** |
| `mark-mono.svg`, `mark-full-mono.svg` | Line art in `currentColor` (outlines only) — one-colour print, embossing, watermarks, dark backgrounds. |
| `mark-halo.svg`, `mark-full-halo.svg` | Colour mark with a cream underlay so the black outlines stay visible on dark backgrounds (proposal — brand board). |

- **Clear space:** the height of an « E » of the mark (≈ 28 % of the mark's height) on every side.
- Favicons and app icons are generated from `mark.svg`: `pnpm --filter @eec/scripts brand:icons`.
- Lockups (mark + wordmark) are added after the display font is chosen (decision 0015).
