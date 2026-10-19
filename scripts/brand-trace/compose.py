import json, sys
L = sys.argv[1]
f = json.load(open(f'{L}/fit.json'))
W = float(sys.argv[5]) if len(sys.argv) > 5 else 8.0
Y, G, K, WH = '#FDED14', '#1D9E2F', '#181916', '#FFFFFF'
sail = f['yellow'][0]['full']
import os
text = json.load(open(f'{L}/text.json'))['text'] if os.path.exists(f'{L}/text.json') else ''
letters = [p['d'] for p in f['green']]
x0, x1, x2, x3 = 716.0, 762.7, 718.0, 758.0   # top arm, shaft
cy0, cy1 = 455.0, 486.0                       # crossbar
cx0, cx1 = 621.0, 852.2
top, bottom = 388.0, 814.2
cross = (f'M{x0} {top}H{x1}V{cy0}H{cx1}V{cy1}H{x3}V{bottom}H{x2}V{cy1}H{cx0}V{cy0}H{x0}Z')
def notch_patch(w):
    (ax, ay), (anx, any_), (bx, by), (bnx, bny) = f['yellow'][0]['notch']
    q = [(ax, ay), (ax + anx * w, ay + any_ * w), (bx + bnx * w, by + bny * w), (bx, by)]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in q) + 'Z'
def mark(extra=''):
    return f'''<g stroke="{K}" stroke-width="{2*W}" stroke-linejoin="miter" stroke-miterlimit="8">
  <path fill="none" d="{f['yellow'][0]['stroke']}"/>
  <path fill="{Y}" stroke="none" d="{sail}{notch_patch(W)}"/>
  <g fill="{G}" paint-order="stroke">{''.join(f'<path d="{d}"/>' for d in letters)}</g>
  <path fill="{WH}" paint-order="stroke" d="{cross}"/>
</g><path fill="{K}" d="{text}"/>{extra}'''
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 843" width="900" height="843">{mark()}</svg>'
open(f'{L}/v1.svg','w').write(svg)
html = f'''<html><body style="margin:0;background:#fff"><div style="position:relative;width:900px;height:843px">
<img src="{sys.argv[2]}" style="position:absolute;inset:0;opacity:{sys.argv[3]}">
<div style="position:absolute;inset:0;opacity:{sys.argv[4]}">{svg}</div></div></body></html>'''
open(f'{L}/overlay.html','w').write(html)
