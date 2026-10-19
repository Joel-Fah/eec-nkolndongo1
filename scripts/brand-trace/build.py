import sys, json
import numpy as np
from PIL import Image
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fit import dense_contours, fit_path, to_d, area, sharpen, open_at, start_of, end_of, bez_d1, unit
from matplotlib.path import Path as MPath
from masks import masks

SRC = sys.argv[2]; OUT = sys.argv[3]
M = masks(SRC)
NOTCH = (78.5, 595.5, 95.5, 623)
NOTCH_CORNERS = [(79.6, 596.6), (92.6, 620.4)]

res = {}
for name, col, tol, th in (('yellow', (253,237,20), 0.6, 35), ('green', (29,158,47), 0.5, 38)):
    cs = dense_contours(M[name])
    paths = []
    for pts in cs:
        segs = fit_path(pts, tol=tol, thresh=th, extra_corners=NOTCH_CORNERS if name == "yellow" else (), no_corner_box=NOTCH if name == "yellow" else None)
        entry = {}
        if name == 'yellow':
            from sail import assemble
            full, runs = assemble(segs)
            entry['stroke'] = ''.join(to_d(r, closed=False) for r in runs)
            entry['full'] = to_d(full)
            run = open_at(segs, NOTCH)
            poly = MPath(pts)
            def tangent(sg, at_start):
                if sg[0] == 'L': return unit(sg[2] - sg[1])
                return unit(bez_d1(sg[1], 0.0 if at_start else 1.0))
            def outward(p, t):
                n = np.array([-t[1], t[0]])
                return n if not poly.contains_point(p + n * 2) else -n
            B, tB = start_of(run[0]), tangent(run[0], True)
            A, tA = end_of(run[-1]), tangent(run[-1], False)
            entry['notch'] = [A.tolist(), outward(A, tA).tolist(), B.tolist(), outward(B, tB).tolist()]
        paths.append({**entry, 'd': to_d(segs), 'n': len(segs), 'area': float(area(pts)), 'bbox': [float(v) for v in (*pts.min(0), *pts.max(0))]})
        np.save(f'{sys.argv[1]}/{name}{len(paths)-1}.npy', pts)
    res[name] = paths
    print(name, [(p['n'], round(p['area']), [round(v) for v in p['bbox']]) for p in paths])
json.dump(res, open(OUT, 'w'), indent=1)
