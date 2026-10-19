# scripts

One-off and build tooling. TypeScript scripts run with plain `node` (Node ≥ 22.18 strips types).

| Command | What |
|---|---|
| `pnpm fonts:fetch` | Downloads the Fontshare fonts (Switzer, Zodiak, Gambetta) into `packages/ui/fonts/fontshare/` (gitignored — licence, see decision 0015). |
| `pnpm contrast` | WCAG contrast table for every text/background token pair, both themes. |
| `pnpm --filter @eec/scripts brand:icons` | Favicons and app icons from `packages/ui/brand/mark.svg`. |
| `bash scripts/brand-trace/run.sh` | Redraws the EEC mark SVGs from the official PNG (see `brand-trace/README.md`). |

Python tools use a local venv (gitignored):

```bash
python3 -m venv scripts/.cache/venv
scripts/.cache/venv/bin/pip install numpy pillow scipy matplotlib potracer
```
