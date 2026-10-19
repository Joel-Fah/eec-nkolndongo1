import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json, numpy as np
from PIL import Image
from fit import dense_contours, fit_path, to_d
L = sys.argv[1]
text = np.asarray(Image.open(f'{L}/text_mask.png')).astype(float) / 255
tol = float(sys.argv[2])
cs = dense_contours(text, K=8, blur=float(sys.argv[3]), turd=1, step=0.12, thr=float(sys.argv[5]) if len(sys.argv) > 5 else 0.5)
d = []; n = 0
for pts in cs:
    if len(pts) < 8:
        continue
    segs = fit_path(pts, tol=tol, thresh=float(sys.argv[4]), line_tol=0.12, snap_deg=0, trim=1.2, line_rel=0.0, max_corner_move=1.5)
    n += len(segs)
    d.append(to_d(segs))
s = ''.join(d)
print(len(cs), 'contours', n, 'segments', len(s), 'chars')
json.dump({'text': s}, open(f'{L}/text.json', 'w'))
