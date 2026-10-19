"""
Builds the self-hosted Fraunces display files (SIL OFL 1.1 — subsetting allowed, no Reserved Font Name).

Source: https://github.com/google/fonts/tree/main/ofl/fraunces (variable TTFs).
- Pins the optical size to display (opsz 72), SOFT 50 (gentle), WONK 1 (the "smirk").
- Keeps the weight axis 300–700.
- Subsets to Latin + French (incl. « » ’ œ and the narrow no-break space U+202F).

Usage (fontTools + brotli in a venv, see scripts/README.md):
  scripts/.cache/venv/bin/python -I scripts/subset-fraunces.py <roman.ttf> <italic.ttf>
"""

import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "packages/ui/fonts/fraunces"

UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+0178,U+02C6,U+02DA,U+02DC,"
    "U+2009,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+202F,U+20AC,U+2122"
)


def build(src: str, name: str) -> None:
    font = TTFont(src)
    font = instancer.instantiateVariableFont(
        font, {"opsz": 72, "SOFT": 50, "WONK": 1, "wght": (300, 700)}
    )
    # Round-trip through memory so the subsetter sees fully loaded tables.
    buffer = io.BytesIO()
    font.save(buffer)
    buffer.seek(0)
    font = TTFont(buffer)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "clig", "calt", "lnum", "pnum", "tnum", "ss01"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.unicodes = subset.parse_unicodes(UNICODES)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=options.unicodes)
    subsetter.subset(font)
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{name}.woff2"
    font.flavor = "woff2"
    font.save(target)
    print(f"{target.name}: {target.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    roman, italic = sys.argv[1], sys.argv[2]
    build(roman, "Fraunces-Display")
    build(italic, "Fraunces-DisplayItalic")
