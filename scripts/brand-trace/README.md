# brand-trace — how the EEC mark SVG was redrawn

The official mark exists only as `assets/images/eec-logo-tr.png` (900×843). These tools turn it into
clean SVG **without redesigning it**. They are a one-off, kept so the redraw is auditable and repeatable.

```bash
python3 -m venv scripts/.cache/venv
scripts/.cache/venv/bin/pip install numpy pillow scipy matplotlib potracer
bash scripts/brand-trace/run.sh     # rewrites packages/ui/brand/*.svg, prints IoU vs the PNG
```

| Step | File | What it does |
|---|---|---|
| Colour masks | `masks.py` | Soft coverage per colour (yellow, green, white, black) by linear unmixing between the two nearest official colours — edges are not biased inward. |
| Contours | `fit.py` | 4× upscale + light blur → dense contour (potrace, tight) → corner detection → corners rebuilt as the intersection of the neighbouring edges (sharp miters) → Schneider cubic fitting, straight runs as lines, near-H/V lines snapped. |
| Sail, letters | `build.py`, `sail.py` | Fits the yellow and green regions. The sail is assembled as one shape that runs **behind** the letters and the cross (its hidden edge follows the E's bowl, because the E counters are transparent in the original), and its outline is an open path that skips the hidden edge and the bottom-left notch (kept, as in the original). |
| Cross | `generate.py` | Measured, not traced: exact horizontals/verticals. The official top arm is 46.7 wide vs a 40 shaft — kept. |
| Arc text | `text.py`, `text_fit.py` | Black pixels minus the rendered outlines = the lettering; traced at 8× and fitted (ink weight matched to the PNG within 0.5%). |
| Output | `generate.py` | All outlines are one width (W = 8.25, measured 8.0–8.5), drawn at 2W under the fill so W shows outside. Colours are the PNG's own: `#FDED14`, `#1D9E2F`, `#181916`, `#FFFFFF`. |
| QA | `compose.py`, `compare.py`, `zoom.py`, `render.sh` | Renders with headless Chrome and compares with the PNG (IoU per colour, diff image, side-by-side zooms). |

Last run: yellow IoU 0.989, green 0.989; remaining differences are ≤ 1–2 px (scan skew of the cross,
anti-aliasing). The brand board (`/fr/_brand`) shows the overlay at 50 %.
