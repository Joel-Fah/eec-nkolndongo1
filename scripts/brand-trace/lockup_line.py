"""Line-art lockup for the preloader: the mark's outlines + « EEC / Paroisse de Nkolndongo 1 » as Fraunces
glyph outlines (OFL), every outline its own path (pathLength=1) so CSS can draw them one after another.
Usage: python lockup_line.py <fit-dir> <Fraunces-Display.woff2> <out.svg>"""
import json, sys
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

L, FONT, OUT = sys.argv[1:4]
fit = json.load(open(f'{L}/fit.json'))
sail = fit['yellow'][0]['stroke']
letters = [p['d'] for p in fit['green']]
cross = 'M716 388H762.7V455H852.2V486H758V814.2H718V486H621V455H716Z'

font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': 600})
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm; hmtx = font['hmtx']

def line(text, size, x, baseline, tracking=0):
    k = size / upm; out = []; pen_x = x
    for ch in text:
        name = cmap.get(ord(ch))
        if name is None: continue
        if ch != ' ':
            pen = SVGPathPen(gs); gs[name].draw(TransformPen(pen, (k, 0, 0, -k, pen_x, baseline)))
            d = pen.getCommands()
            if d: out.append(d)
        pen_x += hmtx[name][0] * k + tracking
    return out

TEXT_X = 930
eec = line('EEC', 118, TEXT_X, 390, 10)
name = line('Paroisse de Nkolndongo 1', 168, TEXT_X, 590, 1)
paths = [sail] + letters + [cross]
glyphs = eec + name
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 120 3000 700" role="img" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><title>EEC Nkolndongo 1</title>']
svg.append('<g stroke-width="9">' + ''.join(f'<path class="ln" pathLength="1" style="--d:{i*0.12:.2f}" d="{d}"/>' for i, d in enumerate(paths)) + '</g>')
base = len(paths) * 0.12
svg.append(''.join(f'<path class="ln" pathLength="1" style="--d:{base + i*0.045:.3f}" d="{d}"/>' for i, d in enumerate(glyphs)))
svg.append('</svg>\n')
open(OUT, 'w').write(''.join(svg))
print(len(glyphs), 'glyph outlines', len(''.join(svg)) // 1024, 'KB')
