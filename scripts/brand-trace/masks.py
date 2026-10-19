import numpy as np
from PIL import Image
CLASSES = {'yellow': (253,237,20), 'green': (29,158,47), 'white': (254,254,254), 'black': (24,25,22)}

def masks(src):
    """Soft per-class coverage via linear unmixing between the two nearest class colours; alpha-weighted."""
    a = np.asarray(Image.open(src).convert('RGBA')).astype(float) / 255
    rgb, al = a[..., :3], a[..., 3]
    names = list(CLASSES)
    C = np.array([CLASSES[n] for n in names]) / 255
    d = np.linalg.norm(rgb[..., None, :] - C[None, None], axis=-1)
    order = np.argsort(d, axis=-1)
    i1, i2 = order[..., 0], order[..., 1]
    c1, c2 = C[i1], C[i2]
    v = c2 - c1
    t = np.clip(np.sum((rgb - c1) * v, -1) / np.maximum(np.sum(v * v, -1), 1e-9), 0, 1)
    out = {}
    for k, n in enumerate(names):
        m = np.where(i1 == k, 1 - t, 0) + np.where(i2 == k, t, 0)
        out[n] = m * al
    return out
