"""Write the brand SVGs (packages/ui/brand/) from the fitted geometry (fit.json, text.json).

Colours are the official mark's own, sampled from assets/images/eec-logo-tr.png. They are never
tuned, except in the monochrome versions (currentColor). Every path is defined once and reused.
"""
import json
import sys
from pathlib import Path

L = Path(sys.argv[1])
OUT = Path(sys.argv[2])
f = json.loads((L / 'fit.json').read_text())
TEXT = json.loads((L / 'text.json').read_text())['text']

W = 8.25                                       # outline width (measured 8.0–8.5 everywhere)
SW = f'{2 * W:g}'                              # drawn at 2W under the fill: W shows outside
YELLOW, GREEN, INK, WHITE = '#FDED14', '#1D9E2F', '#181916', '#FFFFFF'
HALO = '#F3EFE6'                               # dark-theme --ink, for the dark-background option
VIEWBOX = '14 0 850 826'
TITLE = 'Église Évangélique du Cameroun'

SAIL = f['yellow'][0]['full']
SAIL_OUTLINE = f['yellow'][0]['stroke']        # open: skips the notch and the edge hidden by E/C
(ax, ay), (anx, any_), (bx, by), (bnx, bny) = f['yellow'][0]['notch']
NOTCH = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in [
    (ax, ay), (ax + anx * W, ay + any_ * W), (bx + bnx * W, by + bny * W), (bx, by)]) + 'Z'
LETTERS = [p['d'] for p in f['green']]
# Exact horizontals/verticals. The top arm is wider than the shaft (46.7 vs 40) in the official
# artwork — kept as is.
CROSS = 'M716 388H762.7V455H852.2V486H758V814.2H718V486H621V455H716Z'

# z-order: (outline id, fill id)
SHAPES = [('so', 's'), ('e1', 'e1'), ('e2', 'e2'), ('c3', 'c3'), ('x', 'x')]


def defs(p: str, with_text: bool) -> str:
    """Shared geometry, ids prefixed per file so several inline SVGs can coexist."""
    paths = {
        's': SAIL + NOTCH, 'so': SAIL_OUTLINE,
        'e1': LETTERS[0], 'e2': LETTERS[1], 'c3': LETTERS[2], 'x': CROSS,
    }
    if with_text:
        paths['t'] = TEXT
    return ''.join(f'<path id="{p}{k}" d="{d}"/>' for k, d in paths.items())


def use(p: str, k: str, attrs: str = '') -> str:
    return f'<use href="#{p}{k}"{attrs}/>'


def colour(p: str, with_text: bool) -> str:
    s = f' stroke="{INK}" stroke-width="{SW}" stroke-miterlimit="8"'
    return (
        f'<g id="{p}sail">{use(p, "so", f" fill=\"none\"{s}")}{use(p, "s", f" fill=\"{YELLOW}\"")}</g>'
        f'<g id="{p}letters" fill="{GREEN}" paint-order="stroke"{s}>'
        + ''.join(use(p, k) for k in ('e1', 'e2', 'c3')) + '</g>'
        + f'<g id="{p}cross">{use(p, "x", f" fill=\"{WHITE}\" paint-order=\"stroke\"{s}")}</g>'
        + (f'<g id="{p}wordmark">{use(p, "t", f" fill=\"{INK}\"")}</g>' if with_text else '')
    )


def mono(p: str, with_text: bool) -> str:
    """Line art in currentColor: the official outlines, no fills — works on any background.
    Each outline shows only outside its own fill and hides behind every shape in front of it."""
    masks, body = [], []
    for i, (outline, fill) in enumerate(SHAPES):
        front = ''.join(
            use(p, fd) + use(p, od, f' fill="none" stroke="#000" stroke-width="{SW}"')
            for od, fd in SHAPES[i + 1:]
        )
        masks.append(
            f'<mask id="{p}m{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="843">'
            f'<rect width="900" height="843" fill="#fff"/><g fill="#000">{use(p, fill)}{front}</g></mask>'
        )
        body.append(use(p, outline, f' mask="url(#{p}m{i})"'))
    return (
        ''.join(masks) and f'<defs>{"".join(masks)}</defs>'
        f'<g fill="none" stroke="currentColor" stroke-width="{SW}" stroke-miterlimit="8">{"".join(body)}</g>'
        + (use(p, 't', ' fill="currentColor"') if with_text else '')
    )


def halo(p: str, with_text: bool, h: float = 6, ht: float = 3) -> str:
    """Colour mark on a cream underlay following its silhouette (dark-background option)."""
    under = (
        f'<g fill="{HALO}" stroke="{HALO}" stroke-width="{2 * W + 2 * h:g}" stroke-linejoin="round">'
        + ''.join(use(p, k) for k in ('s', 'e1', 'e2', 'c3', 'x'))
        + (use(p, 't', f' stroke-width="{2 * ht:g}"') if with_text else '')
        + '</g>'
    )
    return under + colour(p, with_text)


def svg(p: str, body, with_text: bool, attrs: str = '') -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" role="img"{attrs}>'
        f'<title>{TITLE}</title><defs>{defs(p, with_text)}</defs>{body(p, with_text)}</svg>\n'
    )


def line_art() -> str:
    """Stroke-only mark for the preloader: every outline is one path with pathLength=1, so CSS can draw it."""
    outlines = [SAIL_OUTLINE] + LETTERS + [CROSS]
    paths = ''.join(f'<path class="ln" pathLength="1" d="{d}"/>' for d in outlines)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" role="img" fill="none" stroke="currentColor" '
        f'stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><title>{TITLE}</title>{paths}</svg>\n'
    )


OUT.mkdir(parents=True, exist_ok=True)
files = {
    'mark-full.svg': svg('eecf-', colour, True),
    'mark.svg': svg('eec-', colour, False),
    'mark-mono.svg': svg('eecm-', mono, False),
    'mark-full-mono.svg': svg('eecfm-', mono, True),
    'mark-halo.svg': svg('eech-', halo, False),
    'mark-full-halo.svg': svg('eecfh-', halo, True),
    'mark-line.svg': line_art(),
}
for file, content in files.items():
    (OUT / file).write_text(content)
    print(f'{file}: {len(content.encode()) / 1024:.1f} KB')
