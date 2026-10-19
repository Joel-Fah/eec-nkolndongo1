#!/usr/bin/env bash
# Rebuild packages/ui/brand/*.svg from assets/images/eec-logo-tr.png. Run from the repo root.
# Needs: python venv with fonttools-free deps (numpy pillow scipy matplotlib potracer), Chrome.
set -euo pipefail
PY=${PY:-scripts/.cache/venv/bin/python}
T=scripts/brand-trace
W=scripts/.cache/logo            # work dir (gitignored)
SRC=assets/images/eec-logo-tr.png
mkdir -p "$W"
rm -f "$W/text.json"
cp "$T/render.sh" "$W/"
"$PY" -I "$T/build.py" "$W" "$SRC" "$W/fit.json"            # sail + letters: trace, fit, assemble
python3 "$T/compose.py" "$W" "$(realpath $SRC)" 0 1 8.25      # render without text…
"$T/render.sh" "$W/overlay.html" "$W/mine.png" 900 843
"$PY" -I "$T/text.py" "$W" 0.35 0.4 "$SRC"                    # …to isolate the arc text
"$PY" -I "$T/text_fit.py" "$W" 0.3 0.6 65 0.42
"$PY" -I "$T/generate.py" "$W" packages/ui/brand              # write the SVG variants
python3 "$T/compose.py" "$W" "$(realpath $SRC)" 0 1 8.25 && "$T/render.sh" "$W/overlay.html" "$W/mine.png" 900 843
python3 "$T/compose.py" "$W" "$(realpath $SRC)" 1 0 8.25 && "$T/render.sh" "$W/overlay.html" "$W/ref.png" 900 843
"$PY" -I "$T/compare.py" "$W" "$W/mine.png" "$W/ref.png"     # IoU per colour + diff.png
