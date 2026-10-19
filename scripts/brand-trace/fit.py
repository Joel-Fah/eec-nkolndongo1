"""Turn a raster mask into clean, minimal SVG paths.

dense contour (potrace, tight) -> corner detection -> Schneider cubic fitting / line detection
-> optional H/V snapping. Coordinates are in source pixels.
"""
import math
import numpy as np
from PIL import Image, ImageFilter
import potrace


# ---------- contour extraction ----------
def dense_contours(mask, K=4, blur=0.9, turd=40, step=0.25, thr=0.5):
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    img = img.resize((img.width * K, img.height * K), Image.BICUBIC)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(K * blur))
    m = np.asarray(img) / 255 > thr
    paths = potrace.Bitmap(~m).trace(turdsize=turd * K, alphamax=0.6, opticurve=False)
    out = []
    for curve in paths:
        pts = []
        p0 = np.array([curve.start_point.x, curve.start_point.y])
        for s in curve.segments:
            if s.is_corner:
                c = np.array([s.c.x, s.c.y]); e = np.array([s.end_point.x, s.end_point.y])
                for a, b in ((p0, c), (c, e)):
                    n = max(2, int(np.linalg.norm(b - a) / (step * K)))
                    pts += [a + (b - a) * t for t in np.linspace(0, 1, n, endpoint=False)]
            else:
                c1 = np.array([s.c1.x, s.c1.y]); c2 = np.array([s.c2.x, s.c2.y]); e = np.array([s.end_point.x, s.end_point.y])
                L = np.linalg.norm(c1 - p0) + np.linalg.norm(c2 - c1) + np.linalg.norm(e - c2)
                n = max(2, int(L / (step * K)))
                for t in np.linspace(0, 1, n, endpoint=False):
                    pts.append(bez(np.array([p0, c1, c2, e]), t))
            p0 = np.array([s.end_point.x, s.end_point.y])
        out.append(np.array(pts) / K)
    return out


def area(pts):
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


# ---------- Bezier helpers ----------
def bez(c, t):
    mt = 1 - t
    return mt**3 * c[0] + 3 * mt**2 * t * c[1] + 3 * mt * t**2 * c[2] + t**3 * c[3]


def bez_d1(c, t):
    mt = 1 - t
    return 3 * mt**2 * (c[1] - c[0]) + 6 * mt * t * (c[2] - c[1]) + 3 * t**2 * (c[3] - c[2])


def bez_d2(c, t):
    mt = 1 - t
    return 6 * mt * (c[2] - 2 * c[1] + c[0]) + 6 * t * (c[3] - 2 * c[2] + c[1])


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


# ---------- Schneider fitting ----------
def chord_params(pts):
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return d / d[-1] if d[-1] > 0 else d


def fit_one(pts, u, t1, t2):
    p0, p3 = pts[0], pts[-1]
    b1 = 3 * (1 - u) ** 2 * u
    b2 = 3 * (1 - u) * u**2
    A1 = b1[:, None] * t1
    A2 = b2[:, None] * t2
    base = np.array([bez(np.array([p0, p0, p3, p3]), x) for x in u])
    tmp = pts - base
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    X = np.array([np.sum(A1 * tmp), np.sum(A2 * tmp)])
    det = C[0, 0] * C[1, 1] - C[0, 1] ** 2
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        a1 = a2 = seg / 3
    eps = 1e-6 * seg
    if a1 < eps or a2 < eps:
        a1 = a2 = seg / 3
    return np.array([p0, p0 + t1 * a1, p3 + t2 * a2, p3])


def max_err(c, pts, u):
    d = np.linalg.norm(np.array([bez(c, x) for x in u]) - pts, axis=1)
    i = int(np.argmax(d))
    return d[i], i


def reparam(c, pts, u):
    out = []
    for x, p in zip(u, pts):
        d = bez(c, x) - p; d1 = bez_d1(c, x); d2 = bez_d2(c, x)
        den = d1 @ d1 + d @ d2
        out.append(x - (d @ d1) / den if abs(den) > 1e-12 else x)
    return np.clip(np.array(out), 0, 1)


def fit_cubic(pts, t1, t2, tol):
    if len(pts) <= 2:
        dist = np.linalg.norm(pts[-1] - pts[0]) / 3
        return [np.array([pts[0], pts[0] + t1 * dist, pts[-1] + t2 * dist, pts[-1]])]
    u = chord_params(pts)
    c = fit_one(pts, u, t1, t2)
    err, split = max_err(c, pts, u)
    if err < tol:
        return [c]
    if err < tol * 4:
        for _ in range(8):
            u = reparam(c, pts, u)
            c = fit_one(pts, u, t1, t2)
            err, split = max_err(c, pts, u)
            if err < tol:
                return [c]
    split = min(max(split, 1), len(pts) - 2)
    tc = unit(pts[split - 1] - pts[split + 1])
    return fit_cubic(pts[: split + 1], t1, tc, tol) + fit_cubic(pts[split:], -tc, t2, tol)


# ---------- corners + spans ----------
def corner_indices(pts, win=3.0, thresh=40, closed=True):
    n = len(pts)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    step = max(np.median(seg), 1e-6)
    k = max(2, int(win / step))
    ang = np.zeros(n)
    for i in range(n):
        if not closed and (i < k or i >= n - k):
            continue
        a = pts[i] - pts[(i - k) % n]; b = pts[(i + k) % n] - pts[i]
        ang[i] = math.degrees(math.acos(np.clip(unit(a) @ unit(b), -1, 1)))
    idx = []
    for i in range(n):
        if ang[i] >= thresh and ang[i] == max(ang[(i + j) % n] for j in range(-k, k + 1)):
            if not idx or i - idx[-1] > k:
                idx.append(i)
    return idx


def fit_path(pts, tol=0.5, thresh=40, line_tol=0.45, snap_deg=2.5, closed=True, extra_corners=(),
             trim=5.0, line_rel=0.006, max_corner_move=14.0, no_corner_box=None):
    """extra_corners: points (x, y) that must be corners (nearest contour point is used)."""
    cs = corner_indices(pts, thresh=thresh, closed=closed)
    if no_corner_box is not None:
        bx0, by0, bx1, by1 = no_corner_box
        cs = [i for i in cs if not (bx0 <= pts[i][0] <= bx1 and by0 <= pts[i][1] <= by1)]
    for p in extra_corners:
        cs.append(int(np.argmin(np.linalg.norm(pts - np.array(p), axis=1))))
    cs = sorted(set(cs))
    if closed:
        if not cs:
            cs = [0]
        pts = np.roll(pts, -cs[0], axis=0)
        cs = [c - cs[0] for c in cs] + [len(pts)]
        pts = np.vstack([pts, pts[:1]])
    else:
        cs = sorted(set([0] + cs + [len(pts) - 1]))
    # arc length along the (possibly closed) polyline
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])

    n_open = len(pts) - 1 if closed else len(pts)

    def local_line(i, direction, near=trim, far=trim + 12):
        """Least-squares line through contour points `near..far` px away from index i (wraps if closed)."""
        q, dist, j = [], 0.0, i
        while dist < far:
            k = j + direction
            if closed:
                k %= n_open
            elif not (0 <= k < len(pts)):
                break
            dist += np.linalg.norm(pts[k] - pts[j]); j = k
            if dist > near:
                q.append(pts[k])
            if len(q) > 400:
                break
        q = np.array(q)
        if direction < 0 and len(q):
            q = q[::-1]
        if len(q) < 4:
            return None
        c = q.mean(0); _, _, vt = np.linalg.svd(q - c); d = vt[0]
        if d @ (q[-1] - q[0]) < 0:
            d = -d
        return c, d

    # sharp corners: intersection of the incoming and outgoing local lines
    sharp = {}
    for i in cs:
        if not closed and (i == 0 or i == len(pts) - 1):
            continue
        a, b = local_line(i, -1), local_line(i, +1)
        if a is None or b is None:
            continue
        ang = math.degrees(math.acos(np.clip(a[1] @ b[1], -1, 1)))
        if ang < 20:
            continue
        x = _intersect(a[0], a[1], b[0], -b[1])
        if x is not None and np.linalg.norm(x - pts[i]) < max_corner_move:
            sharp[i] = (x, a[1], b[1])
    if closed and cs[0] in sharp:
        sharp[cs[-1]] = sharp[cs[0]]

    segs = []
    for a, b in zip(cs[:-1], cs[1:]):
        span = pts[a : b + 1]
        if len(span) < 2:
            continue
        t1 = t2 = None
        if a in sharp or b in sharp:
            keep = np.ones(len(span), bool)
            sa = arc[a : b + 1]
            if a in sharp:
                keep &= sa > arc[a] + trim * 0.5
                t1 = sharp[a][2]
            if b in sharp:
                keep &= sa < arc[b] - trim * 0.5
                t2 = -sharp[b][1]
            inner = span[keep]
            start = sharp[a][0] if a in sharp else span[0]
            end = sharp[b][0] if b in sharp else span[-1]
            span = np.vstack([[start], inner, [end]])
        chord = span[-1] - span[0]
        L = np.linalg.norm(chord)
        if L > 0:
            nrm = np.array([-chord[1], chord[0]]) / L
            dev = np.abs((span - span[0]) @ nrm).max()
            if dev < max(line_tol, L * line_rel):
                segs.append(['L', span[0].copy(), span[-1].copy()])
                continue
        if t1 is None:
            t1 = unit(span[min(3, len(span) - 1)] - span[0])
        if t2 is None:
            t2 = unit(span[max(-4, -len(span))] - span[-1])
        for c in fit_cubic(span, t1, t2, tol):
            segs.append(['C', c])
    for i, s in enumerate(segs):
        if s[0] != 'L':
            continue
        a, b = s[1], s[2]
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
        if min(ang, 180 - ang) < snap_deg:
            y = round((a[1] + b[1]) / 2 * 2) / 2
            set_point(segs, i, 'start', np.array([a[0], y]), closed); set_point(segs, i, 'end', np.array([b[0], y]), closed)
        elif abs(ang - 90) < snap_deg:
            x = round((a[0] + b[0]) / 2 * 2) / 2
            set_point(segs, i, 'start', np.array([x, a[1]]), closed); set_point(segs, i, 'end', np.array([x, b[1]]), closed)
    return segs


def start_of(s):
    return s[1] if s[0] == 'L' else s[1][0]


def end_of(s):
    return s[2] if s[0] == 'L' else s[1][3]


def set_point(segs, i, which, p, closed=True):
    n = len(segs)
    def move(j, where, p):
        if not (0 <= j < n):
            return
        s = segs[j]
        if s[0] == 'L':
            if where == 'start': s[1] = p
            else: s[2] = p
        else:
            c = s[1].copy()
            if where == 'start':
                c[1] = c[1] + (p - c[0]); c[0] = p
            else:
                c[2] = c[2] + (p - c[3]); c[3] = p
            s[1] = c
    if which == 'start':
        move(i, 'start', p)
        if closed or i > 0: move((i - 1) % n, 'end', p)
    else:
        move(i, 'end', p)
        if closed or i < n - 1: move((i + 1) % n, 'start', p)


def fmt(v):
    s = f'{v:.1f}'
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def to_d(segs, closed=True):
    p = start_of(segs[0])
    d = [f'M{fmt(p[0])} {fmt(p[1])}']
    cur = p
    for s in segs:
        if s[0] == 'L':
            e = s[2]
            if abs(e[1] - cur[1]) < 1e-6:
                d.append(f'H{fmt(e[0])}')
            elif abs(e[0] - cur[0]) < 1e-6:
                d.append(f'V{fmt(e[1])}')
            else:
                d.append(f'L{fmt(e[0])} {fmt(e[1])}')
            cur = e
        else:
            c = s[1]
            d.append('C' + ' '.join(f'{fmt(c[k][0])} {fmt(c[k][1])}' for k in (1, 2, 3)))
            cur = c[3]
    if closed:
        d.append('Z')
    return ''.join(d)


# ---------- post-processing ----------
def _end_tangent(s, back):
    """Point `back` px before the end of segment s, and unit tangent pointing toward the end."""
    if s[0] == 'L':
        a, b = s[1], s[2]; t = unit(b - a)
        return b - t * min(back, np.linalg.norm(b - a) * 0.5), t
    c = s[1]; L = np.linalg.norm(c[3] - c[0]) + 1e-9
    u = max(0.5, 1 - back / L)
    return bez(c, u), unit(bez_d1(c, u))


def _start_tangent(s, fwd):
    if s[0] == 'L':
        a, b = s[1], s[2]; t = unit(b - a)
        return a + t * min(fwd, np.linalg.norm(b - a) * 0.5), t
    c = s[1]; L = np.linalg.norm(c[3] - c[0]) + 1e-9
    u = min(0.5, fwd / L)
    return bez(c, u), unit(bez_d1(c, u))


def _intersect(p, r, q, s):
    den = r[0] * s[1] - r[1] * s[0]
    if abs(den) < 1e-9:
        return None
    t = ((q - p)[0] * s[1] - (q - p)[1] * s[0]) / den
    return p + t * r


def sharpen(segs, min_angle=30, back=6.0, max_move=12.0):
    """Restore sharp corners rounded by tracing: move each strong joint to the tangents' intersection."""
    n = len(segs)
    for i in range(n):
        A, B = segs[i], segs[(i + 1) % n]
        pa, ta = _end_tangent(A, back)
        pb, tb = _start_tangent(B, back)
        ang = math.degrees(math.acos(np.clip(ta @ tb, -1, 1)))
        if ang < min_angle:
            continue
        x = _intersect(pa, ta, pb, -tb)
        if x is None or np.linalg.norm(x - end_of(A)) > max_move:
            continue
        set_point(segs, i, 'end', x)
    return segs


def open_at(segs, box):
    """Drop segments lying inside box (x0, y0, x1, y1) and return the rest as an open run."""
    x0, y0, x1, y1 = box
    def inside(p):
        return x0 <= p[0] <= x1 and y0 <= p[1] <= y1
    drop = [i for i, s in enumerate(segs) if inside(start_of(s)) and inside(end_of(s))]
    if not drop:
        raise ValueError('no segment in box')
    last = drop[-1]
    rest = segs[last + 1:] + segs[:drop[0]]
    return rest
