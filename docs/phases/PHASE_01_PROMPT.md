# Phase 01 — prompt for Claude Code

Paste the text below into Claude Code, started at the repo root (`eec_nkl1/`), ideally in **plan mode**.

---

You're joining the EEC Nkolndongo 1 project as the engineering partner. It's the website and admin
platform for my parish, the Paroisse EEC Nkolndongo 1 (Église Évangélique du Cameroun, Yaoundé). I'm
Joël: product owner, super admin, and for now the only developer. I care about technology that is
**useful and functional** first, with a modern, gentle, elegant UI that tells a story. It should be
built for people on mid-range Android phones and paid mobile data. French first, English second,
light and dark themes.

Phase 00 (framing) is done. Everything we decided is documented in the repo. Your job now is
**Phase 01 — Brand & Foundations**, specified in `docs/phases/PHASE_01_INSTRUCTIONS.md`.

**How I want you to work:**

1. **Read before acting:**
   - `CLAUDE.md`, `STATUS.md`, `ARCHITECTURE.md`
   - everything in `docs/design/`, `docs/product/navigation.md`, `docs/product/pages.md`, `docs/ops/ci-cd.md`
   - the decision records in `docs/decisions/`
   - the skills in `.claude/skills/` (if the skills are still in `_claude/`, step 1 of the instructions fixes that)
   - the instruction file in full
2. **Plan first.** Give me a short plan of the steps you'll take, the exact package versions you
   intend to use (latest stable, checked now, not from memory), and any risks or questions. Wait for
   my go-ahead.
3. **Follow the instruction file in order.** It has two hard checkpoints:
   - **Checkpoint A** after the brand board: stop and show me the board, screenshots, the 3 font
     pairings with your recommendation, and any colour changes the contrast check required. Don't
     continue until I approve.
   - **Checkpoint B** at the end: report, docs updated, PR opened.
4. **Use the project skills** whenever their topic comes up: `design-system` for any UI,
   `svg-illustration` for illustrations, `gsap-motion` for animation, `i18n-content` for any text.
5. **Respect the non-negotiables in `CLAUDE.md`:**
   - French first, no hard-coded strings
   - tokens only, both themes
   - the performance budget, with zero third-party requests on public pages
   - WCAG 2.2 AA and reduced motion
   - no secrets in git (the repo is public)
   - frugal CI
   - **never invent facts about the parish**: use `[À VALIDER: …]` placeholders
6. **The logo is official.** Redraw it faithfully as SVG, never redesign it, and show me an overlay
   comparison.
7. **Illustrations are original.** The references in `assets/images/illustration_references/` are for
   style inspiration only: never trace or reproduce them.
8. **Design feel:** modern, subtle, sleek, welcoming, charming, elegant, with a little smirk.
   Rounded shapes that are a bit more rounded than usual, Apple-like, but **no pill shapes and no
   squircles**. Every component, including dropdowns and selects, must look on-brand.
   - Fonts: Switzer for text and UI. **No Inter, no Geist.**
   - Icons: Hugeicons stroke-rounded only.
9. **Commits:** Conventional Commits, small and logical, on `feat/phase-01-foundations`. Push only
   at checkpoints. Ask me before the first push to `main`.
10. **Ask instead of guessing** when docs conflict, a download or tool is blocked, a budget can't be
    met, or you want a dependency the docs don't list. Mention small deviations in the final report
    rather than interrupting me for each one.
11. **Keep `STATUS.md` current** at the end of the phase, and write `docs/phases/PHASE_01_REPORT.md`.

If something I'm asking for is technically a bad idea, tell me plainly and propose the better path.
That's part of the job.

Start with step 2: read everything, then give me your plan.
