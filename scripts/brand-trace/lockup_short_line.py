"""Line-art short lockup for the preloader: the mark's line paths (mark-line.svg) + « EEC / Nkolndongo 1 » as
Erode glyph outlines. Each outline is its own path (pathLength=1, --d delay) so CSS draws them one after
another; a filled copy (mark in colour + text in ink) fades in once the drawing is done.
Erode is ITF FFL: the outlines are drawn into our own lockup artwork (like any logo set in a licensed font),
the font file itself is not redistributed.
Usage: scripts/.cache/venv/bin/python -I scripts/brand-trace/lockup_short_line.py <Erode-Variable.woff2> <out.svg>"""
import re, sys
from pathlib import Path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT, OUT = sys.argv[1:3]
root = Path(__file__).resolve().parents[2]
mark_line = (root / 'packages/ui/brand/mark-line.svg').read_text()
mark_paths = re.findall(r'<path class="ln" pathLength="1" d="([^"]+)"', mark_line)
mark_full = (root / 'packages/ui/brand/mark.svg').read_text()
mark_inner = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', mark_full.strip()).replace('<title>Église Évangélique du Cameroun</title>', '')

def glyphs(text, weight, size, x, baseline, tracking=0.0):
    font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': weight})
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; hmtx = font['hmtx']
    k = size / upm; out = []; pen_x = x
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None: continue
        if ch != ' ':
            pen = SVGPathPen(gs); gs[name].draw(TransformPen(pen, (k, 0, 0, -k, pen_x, baseline)))
            if pen.getCommands(): out.append(pen.getCommands())
        pen_x += hmtx[name][0] * k + tracking
    return out, pen_x

X = 960
eec, w1 = glyphs('EEC', 600, 330, X, 400, 18)
name, w2 = glyphs('Nkolndongo 1', 500, 250, X, 690, 0)
width = int(max(w1, w2) + 40)
step_mark, step_text, start_text = 0.15, 0.06, 0.45
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 0 {width} 826" role="img" fill="none" stroke-linecap="round" stroke-linejoin="round"><title>EEC Nkolndongo 1</title>']
svg.append('<g class="lk-line">')
svg += [f'<path class="ln" pathLength="1" style="--d:{i*step_mark:.2f}s" d="{d}"/>' for i, d in enumerate(mark_paths)]
svg += [f'<path class="ln ln-text" pathLength="1" style="--d:{start_text + i*step_text:.2f}s" d="{d}"/>' for i, d in enumerate(eec + name)]
svg.append('</g><g class="lk-fill">')
svg.append(f'<svg x="14" y="0" width="850" height="826" viewBox="14 0 850 826">{mark_inner}</svg>')
svg.append('<path class="lk-text" d="' + ' '.join(eec + name) + '"/>')
svg.append('</g></svg>\n')
Path(OUT).write_text(''.join(svg))
print(len(mark_paths), 'mark paths,', len(eec + name), 'glyphs, width', width, '·', len(''.join(svg)) // 1024, 'KB')
