"""Assemble the full sail from the fitted visible yellow contour (see build.py)."""
import numpy as np
from fit import to_d, start_of, end_of, unit, bez_d1

def P(x, y): return np.array([x, y], float)

def line(a, b): return ['L', P(*a), P(*b)]

def cub(a, c1, c2, b): return ['C', np.array([P(*a), P(*c1), P(*c2), P(*b)])]

def assemble(segs):
    # segs index = token index - 1 (see fit.json listing)
    up_to_e2 = [s for s in segs[0:11]]           # bottom-left corner -> notch -> diagonal -> tip -> P1
    from_c3 = [s for s in segs[39:]]              # P2 -> right edge -> bottom-right -> bottom edge
    p1 = end_of(up_to_e2[-1]); p2 = start_of(from_c3[0])
    assert np.allclose(p1, (536.6, 375.8), atol=1.5), p1
    assert np.allclose(p2, (562.9, 522.7), atol=1.5), p2  # moved to (564, 526.5) below
    # Hidden edge behind E2 (its counters are transparent in the original), then under C3's outline.
    bridge = [
        line(p1, (537, 397)),
        cub((537, 397), (505, 398), (452, 414), (447, 452)),
        cub((447, 452), (442, 492), (470, 530), (500, 536)),
        line((500, 536), (512, 534)),
    ]
    # Visible again right of E2's lower arm: a short horizontal edge into C3's outline.
    emerge = [cub((512, 534), (524, 531), (536, 526.5), (546, 526.5)), line((546, 526.5), (564, 526.5))]
    c = from_c3[0][1].copy(); c[1] = c[1] + (P(564, 526.5) - c[0]); c[0] = P(564, 526.5); from_c3[0][1] = c
    # Bottom-right: extend under the cross outline (the sail sits behind the cross).
    r1, r2, bottom = from_c3[1], from_c3[2], from_c3[3]
    c = r1[1].copy(); c[2] = c[2] + (P(714, 651.2) - c[3]); c[3] = P(714, 651.2); r1[1] = c
    b = bottom[1].copy(); b[1] = b[1] + (P(714, 688) - b[0]); b[0] = P(714, 688); bottom[1] = b
    from_c3[2] = line((714, 651.2), (714, 688))
    full = up_to_e2 + bridge + emerge + from_c3
    # Visible outline: skip the notch (segs 1-4) and the hidden bridge.
    stroke_a = segs[5:11]                 # A (notch top) -> diagonal -> tip -> right corner -> P1
    stroke_b = emerge + from_c3 + [segs[0]]        # P2 -> bottom-right -> bottom -> bottom-left -> B (notch bottom)
    return full, [stroke_a, stroke_b]
