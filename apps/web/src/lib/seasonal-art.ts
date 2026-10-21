/**
 * The little things that fall in the footer playground, one garden per liturgical season. Everything is
 * drawn here, by hand or by a few lines of geometry, on a 100 × 100 grid centred on (50, 50), tip up.
 * Colours are token names (resolved at run time, so light/dark and the season accent apply); the detail
 * strokes (veins, stems) are drawn in `--ink` at low opacity and the highlights in `--surface`.
 * Browser only (Path2D): imported on demand by scripts/playground.ts.
 */
import type { Season } from '@eec/core'

export type ColourToken =
  | 'primary'
  | 'success'
  | 'season'
  | 'gold'
  | 'clay'
  | 'danger'
  | 'info'
  | 'warning'
  | 'ink-muted'
  | 'line-strong'

export type Motif = {
  fill?: Path2D
  /** A line drawing (twigs, snowflakes): stroked in the colour itself. */
  line?: { path: Path2D; width: number }
  /** Veins and stems over the fill (ink, soft). */
  detail?: { path: Path2D; width: number }
  /** A lighter inner shape (flames, petals' hearts). */
  glow?: Path2D
  /** 0.2 (a feather) … 1 (a twig): how fast it falls and how hard it is to push. */
  weight: number
  /** How much it sways while falling. */
  flutter: number
  /** Size range in px. */
  size: [number, number]
  /** Relative frequency inside its garden. */
  share: number
}

export type Garden = { colours: ColourToken[]; motifs: Motif[] }

const P = (d: string) => new Path2D(d)

/** A regular star with `n` points; `inner` is the inner radius as a share of the outer one. */
function star(n: number, inner: number): Path2D {
  const p = new Path2D()
  const pts: [number, number][] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 46 : 46 * inner
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r])
  }
  for (const [i, [x, y]] of pts.entries()) {
    if (i) p.lineTo(x, y)
    else p.moveTo(x, y)
  }
  p.closePath()
  return p
}

/** `fn` is drawn once per step of a rotation around (50, 50). */
function around(count: number, fn: (path: Path2D) => void): Path2D {
  const all = new Path2D()
  for (let i = 0; i < count; i++) {
    const one = new Path2D()
    fn(one)
    all.addPath(
      one,
      new DOMMatrix()
        .translate(50, 50)
        .rotate((360 / count) * i)
        .translate(-50, -50),
    )
  }
  return all
}

/** Pairs of needles or leaflets along a stem (fir twig, palm, olive branch). */
function branch(
  steps: number,
  y0: number,
  y1: number,
  span: number,
  leaflet: (p: Path2D, x: number, y: number, side: 1 | -1, len: number) => void,
): Path2D {
  const p = new Path2D()
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const y = y0 + (y1 - y0) * t
    const len = span * (1 - t * 0.55)
    leaflet(p, 50, y, 1, len)
    leaflet(p, 50, y, -1, len)
  }
  return p
}

const needle = (p: Path2D, x: number, y: number, side: 1 | -1, len: number) => {
  p.moveTo(x, y)
  p.lineTo(x + side * len, y - len * 0.55)
}

const leaflet = (p: Path2D, x: number, y: number, side: 1 | -1, len: number) => {
  p.moveTo(x, y)
  p.quadraticCurveTo(x + side * len * 0.55, y - len * 0.7, x + side * len, y - len * 0.3)
  p.quadraticCurveTo(x + side * len * 0.55, y + len * 0.02, x, y)
  p.closePath()
}

const wheatGrains = () => {
  const p = new Path2D()
  for (const [y, k] of [
    [46, 1],
    [34, 0.9],
    [22, 0.8],
  ] as const) {
    for (const side of [1, -1] as const) {
      const g = new Path2D('M0 0C-7 -5 -7 -15 0 -22C7 -15 7 -5 0 0Z')
      p.addPath(
        g,
        new DOMMatrix()
          .translate(50, y)
          .rotate(side * 32)
          .scale(k)
          .translate(0, 0),
      )
    }
  }
  p.addPath(
    new Path2D('M0 0C-7 -5 -7 -15 0 -22C7 -15 7 -5 0 0Z'),
    new DOMMatrix().translate(50, 14).scale(0.9),
  )
  return p
}

const mapleLeaf =
  'M50 4L58 22L70 14L68 34L90 30L78 50L92 60L66 66L68 74L54 72L54 96L46 96L46 72L32 74L34 66L8 60L22 50L10 30L32 34L30 14L42 22Z'
const broadLeaf = 'M50 6C78 22 90 52 50 94C10 52 22 22 50 6Z'
const slimLeaf = 'M50 4C66 30 66 70 50 96C34 70 34 30 50 4Z'
const oakLeaf =
  'M50 8C58 10 62 20 70 18C80 18 78 30 84 36C92 44 84 52 82 58C90 66 80 76 72 76C68 86 58 88 50 94C42 88 32 86 28 76C20 76 10 66 18 58C16 52 8 44 16 36C22 30 20 18 30 18C38 20 42 10 50 8Z'
const flameShape =
  'M50 4C62 24 84 40 80 66C77 86 64 96 50 96C36 96 23 86 20 66C17 48 32 40 38 24C42 34 46 30 50 4Z'
const twigLines = 'M18 90C40 68 56 50 82 12M44 64L28 52M57 47L74 52M67 31L57 18'

// ── Motifs shared by several gardens ────────────────────────────────────────────────────────────────
const leaf = (d: string, veins: string, size: [number, number], share = 1): Motif => ({
  fill: P(d),
  detail: { path: P(veins), width: 2.4 },
  weight: 0.35,
  flutter: 1,
  size,
  share,
})
const veinsBroad = 'M50 14V92M50 40L34 28M50 54L68 40M50 66L32 54'
const veinsOak = 'M50 14V90M50 40L30 34M50 40L70 34M50 58L26 56M50 58L74 56'
const twig: Motif = {
  line: { path: P(twigLines), width: 6 },
  weight: 0.8,
  flutter: 0.35,
  size: [34, 52],
  share: 0.8,
}
const sparkle = (size: [number, number], share = 0.6): Motif => ({
  fill: star(4, 0.28),
  weight: 0.25,
  flutter: 0.6,
  size,
  share,
})
const firTwig: Motif = {
  line: {
    path: (() => {
      const p = new Path2D('M50 96V8')
      p.addPath(branch(7, 84, 24, 26, needle))
      return p
    })(),
    width: 5,
  },
  weight: 0.6,
  flutter: 0.5,
  size: [32, 50],
  share: 1,
}
const berry = (size: [number, number], share = 0.7): Motif => ({
  fill: P('M50 50m-30 0a30 30 0 1 0 60 0a30 30 0 1 0 -60 0Z'),
  glow: P('M38 38m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0Z'),
  weight: 0.7,
  flutter: 0.2,
  size,
  share,
})
const feather: Motif = {
  fill: P('M50 4C80 20 84 60 52 96C40 70 24 50 50 4Z'),
  detail: { path: P('M52 94C50 70 50 40 50 10'), width: 2.4 },
  weight: 0.22,
  flutter: 1.5,
  size: [24, 38],
  share: 0.8,
}
const petal = (size: [number, number], share = 1): Motif => ({
  fill: P('M50 94C20 80 6 50 26 22C38 8 62 8 74 22C94 50 80 80 50 94Z'),
  glow: P('M50 80C34 68 28 50 38 34C44 26 56 26 62 34C72 50 66 68 50 80Z'),
  weight: 0.25,
  flutter: 1.3,
  size,
  share,
})
const blossom: Motif = {
  fill: around(5, (p) => p.arc(50, 26, 17, 0, Math.PI * 2)),
  glow: P('M50 50m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z'),
  weight: 0.3,
  flutter: 0.9,
  size: [24, 38],
  share: 1,
}
const tulip: Motif = {
  fill: P('M16 26C16 62 30 84 50 90C70 84 84 62 84 26C72 38 62 30 50 14C38 30 28 38 16 26Z'),
  glow: P('M50 22C44 40 44 62 50 80C56 62 56 40 50 22Z'),
  weight: 0.35,
  flutter: 0.8,
  size: [24, 36],
  share: 0.7,
}
const flame: Motif = {
  fill: P(flameShape),
  glow: P('M50 40C58 54 66 62 62 76C60 86 56 90 50 90C44 90 40 86 38 76C35 62 44 56 50 40Z'),
  weight: 0.28,
  flutter: 1,
  size: [26, 42],
  share: 1,
}
const snowflake: Motif = {
  line: {
    path: around(6, (p) => {
      p.moveTo(50, 50)
      p.lineTo(50, 6)
      p.moveTo(50, 22)
      p.lineTo(40, 12)
      p.moveTo(50, 22)
      p.lineTo(60, 12)
      p.moveTo(50, 34)
      p.lineTo(43, 28)
      p.moveTo(50, 34)
      p.lineTo(57, 28)
    }),
    width: 4.5,
  },
  weight: 0.22,
  flutter: 1.2,
  size: [22, 38],
  share: 1,
}
const olive: Motif = {
  fill: P(slimLeaf),
  detail: { path: P('M50 10V92'), width: 2.2 },
  weight: 0.3,
  flutter: 1,
  size: [24, 40],
  share: 1,
}
const palm: Motif = {
  fill: branch(5, 82, 24, 40, leaflet),
  line: { path: P('M50 98V6'), width: 5 },
  weight: 0.55,
  flutter: 0.6,
  size: [44, 64],
  share: 1,
}
const ash: Motif = {
  fill: P('M30 40C34 24 54 18 68 28C82 36 80 58 66 70C52 82 30 74 26 58C24 52 26 46 30 40Z'),
  weight: 0.4,
  flutter: 0.4,
  size: [12, 24],
  share: 1.2,
}
const ear: Motif = {
  fill: wheatGrains(),
  line: { path: P('M50 98V30'), width: 4 },
  weight: 0.5,
  flutter: 0.5,
  size: [38, 56],
  share: 1,
}
const grain: Motif = {
  fill: P('M50 4C70 22 70 70 50 96C30 70 30 22 50 4Z'),
  weight: 0.45,
  flutter: 0.5,
  size: [12, 18],
  share: 1,
}
const fruit: Motif = {
  fill: P('M50 30C20 22 6 52 20 76C30 94 42 92 50 88C58 92 70 94 80 76C94 52 80 22 50 30Z'),
  line: { path: P('M50 32C50 22 54 14 62 8'), width: 5 },
  glow: P('M30 48C26 56 28 66 34 72C30 64 30 56 34 48Z'),
  weight: 0.85,
  flutter: 0.15,
  size: [22, 32],
  share: 0.55,
}
const seed: Motif = {
  fill: P('M50 50C50 30 62 14 80 10C84 30 72 48 54 54Z M42 52a8 8 0 1 0 16 0a8 8 0 1 0 -16 0Z'),
  weight: 0.3,
  flutter: 1.4,
  size: [16, 26],
  share: 0.7,
}
const holly: Motif = {
  fill: P(
    'M50 6L58 18L72 14L70 28L86 34L74 46L88 58L72 62L74 78L58 76L50 94L42 76L26 78L28 62L12 58L26 46L14 34L30 28L28 14L42 18Z',
  ),
  detail: { path: P('M50 14V88'), width: 2.4 },
  weight: 0.35,
  flutter: 0.9,
  size: [24, 38],
  share: 1,
}

/** One garden per season: colours and what falls. */
export const gardens: Record<Season, Garden> = {
  ordinaire: {
    colours: ['primary', 'success', 'season', 'gold'],
    motifs: [
      leaf(broadLeaf, veinsBroad, [24, 40]),
      leaf(oakLeaf, veinsOak, [26, 42], 0.8),
      leaf(slimLeaf, 'M50 10V92', [22, 36], 0.9),
      twig,
      seed,
    ],
  },
  avent: {
    colours: ['season', 'gold', 'primary', 'ink-muted'],
    motifs: [
      firTwig,
      { fill: star(5, 0.45), weight: 0.3, flutter: 0.8, size: [18, 30], share: 0.8 },
      berry([12, 18]),
      sparkle([14, 24]),
    ],
  },
  noel: {
    colours: ['gold', 'primary', 'danger', 'info'],
    motifs: [
      { fill: star(8, 0.42), weight: 0.3, flutter: 0.8, size: [20, 34], share: 1 },
      snowflake,
      holly,
      berry([10, 16], 0.6),
      sparkle([12, 20], 0.8),
    ],
  },
  epiphanie: {
    colours: ['gold', 'info', 'season', 'primary'],
    motifs: [
      { fill: star(5, 0.45), weight: 0.3, flutter: 0.8, size: [20, 34], share: 1 },
      { fill: star(8, 0.42), weight: 0.3, flutter: 0.8, size: [18, 30], share: 0.8 },
      sparkle([12, 22], 1),
      feather,
    ],
  },
  careme: {
    colours: ['season', 'ink-muted', 'line-strong', 'clay'],
    motifs: [
      twig,
      { ...twig, size: [26, 40], share: 0.8 },
      ash,
      leaf(slimLeaf, 'M50 10V92', [20, 32], 0.6),
    ],
  },
  'semaine-sainte': {
    colours: ['season', 'danger', 'primary', 'ink-muted'],
    motifs: [palm, olive, { ...olive, size: [20, 32] }, petal([20, 32], 0.8)],
  },
  paques: {
    colours: ['gold', 'clay', 'info', 'primary'],
    motifs: [blossom, petal([18, 30]), tulip, sparkle([12, 20], 0.5)],
  },
  pentecote: {
    colours: ['season', 'clay', 'gold', 'warning'],
    motifs: [flame, { ...flame, size: [18, 30], share: 0.9 }, feather, sparkle([12, 20], 0.8)],
  },
  moissons: {
    colours: ['season', 'gold', 'clay', 'warning'],
    motifs: [
      ear,
      grain,
      leaf(mapleLeaf, 'M50 12V94', [26, 42], 0.9),
      fruit,
      leaf(oakLeaf, veinsOak, [24, 38], 0.7),
    ],
  },
}
