import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd
from masks import masks
import potrace
L = sys.argv[1]
M = masks(sys.argv[4] if len(sys.argv) > 4 else 'assets/images/eec-logo-tr.png')
k = M['black']
mine = np.asarray(Image.open(f'{L}/mine.png').convert('RGB')).astype(int)
mb = (mine.max(-1) < 120)
mb = nd.binary_dilation(mb, iterations=2)
region = np.zeros_like(mb); region[630:720, 110:660] = True
text = np.where(region & ~mb, k, 0)
Image.fromarray((text * 255).astype(np.uint8)).save(f'{L}/text_mask.png')
K = 8
img = Image.fromarray((np.clip(text, 0, 1) * 255).astype(np.uint8))
img = img.resize((img.width * K, img.height * K), Image.BICUBIC).filter(ImageFilter.GaussianBlur(K * float(sys.argv[2])))
m = np.asarray(img) / 255 > 0.5
paths = potrace.Bitmap(~m).trace(turdsize=6 * K * K // 4, alphamax=1.0, opticurve=True, opttolerance=float(sys.argv[3]))
d = []
nseg = 0
for c in paths:
    p = [f'M{c.start_point.x/K:.2f} {c.start_point.y/K:.2f}']
    for s in c.segments:
        nseg += 1
        if s.is_corner:
            p.append(f'L{s.c.x/K:.2f} {s.c.y/K:.2f}L{s.end_point.x/K:.2f} {s.end_point.y/K:.2f}')
        else:
            p.append(f'C{s.c1.x/K:.2f} {s.c1.y/K:.2f} {s.c2.x/K:.2f} {s.c2.y/K:.2f} {s.end_point.x/K:.2f} {s.end_point.y/K:.2f}')
    d.append(''.join(p) + 'Z')
print(len(paths), 'curves', nseg, 'segments', sum(map(len, d)), 'chars')
json.dump({'text': ''.join(d)}, open(f'{L}/text.json', 'w'))
