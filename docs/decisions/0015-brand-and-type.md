# 0015 — Brand and type
**Status:** Proposed (brand board, Checkpoint A) · 2026-10-19

## Font hosting (agreed with Joël while planning Phase 01)
**Context:** Switzer, Zodiak and Gambetta come from Fontshare under the ITF Free Font License v2.0
(17 Aug 2026). It allows self-hosting on our own websites, but forbids (§02, §05) subsetting, format
conversion, and distributing the files "through … a repository … or publicly accessible servers".
Our repo is public (AGPL).
**Decision:**
- Fontshare files are **never committed**. `pnpm fonts:fetch` (`scripts/fonts-fetch.ts`) downloads the
  official WOFF2s from Fontshare into `packages/ui/fonts/fontshare/` (gitignored), locally and in CI
  (cached). Each developer thus obtains their own copy from Fontshare, as the licence requires.
- They are served **unmodified** (no subsetting). Official Switzer WOFF2s are already Latin-only:
  Regular ≈ 16.7 KB, Medium/Semibold ≈ 20 KB, Variable ≈ 43 KB.
- None of the candidate fonts (Fontshare or Fraunces) has U+202F, the narrow no-break space used before
  `; ! ?` in French. The browser falls back to the system font for that one blank character (Roboto,
  Segoe UI and SF include it) — invisible, and no extra download.
- **Fraunces** (SIL OFL 1.1, no Reserved Font Name) is subset (Latin + French), axis-pinned
  (opsz 72, SOFT 50, WONK 1) and committed with `OFL.txt` (`scripts/subset-fraunces.py`).
- The repository licence (AGPL) does not cover fonts or the EEC logo (README).

## Display font, palette, logo
_To be completed after Joël's approval of the brand board._
