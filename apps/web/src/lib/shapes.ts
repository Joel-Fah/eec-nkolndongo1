/**
 * Image shapes for the page heroes: SVG clipPaths in objectBoundingBox units (0–1), so a shape stretches
 * to its box. Each is a few paths (a union): `blocks` is a stepped trio of rounded blocks whose empty
 * corners are where the cards sit. `ar` is the width / height of the box that shows it best.
 */
export type ShapeId =
  | 'blob'
  | 'windows'
  | 'blocks'
  | 'flower'
  | 'leaf'
  | 'drop'
  | 'squircle'
  | 'stadium'
  | 'arch'
  | 'sail'
  | 'circle'

const polar = (r: (a: number) => number, n = 120) =>
  `M${Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const rad = r(a)
    return `${(0.5 + Math.cos(a) * rad).toFixed(4)},${(0.5 + Math.sin(a) * rad).toFixed(4)}`
  }).join('L')}Z`

const rect = (x: number, y: number, w: number, h: number, r: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"/>`

export const shapes: Record<ShapeId, { ar: number; defs: string }> = {
  blob: {
    ar: 1,
    defs: '<path d="M0.52 0.02C0.74 0 0.96 0.14 0.98 0.38 1 0.6 0.9 0.8 0.7 0.92 0.52 1.02 0.28 0.98 0.14 0.84 0 0.7-0.02 0.46 0.08 0.28 0.18 0.1 0.34 0.04 0.52 0.02Z"/>',
  },
  windows: {
    ar: 1.05,
    defs: '<path d="M0 1V0.4C0 0.2 0.1 0.12 0.235 0.12 0.37 0.12 0.47 0.2 0.47 0.4V1Z"/><path d="M0.53 1V0.3C0.53 0.1 0.63 0 0.765 0 0.9 0 1 0.1 1 0.3V1Z"/>',
  },
  blocks: {
    ar: 1,
    // Top block, middle block pushed right, bottom block: a stepped "S" with two empty corners.
    defs: `${rect(0, 0, 0.64, 0.36, 0.11)}${rect(0.36, 0.32, 0.64, 0.37, 0.11)}${rect(0, 0.65, 0.64, 0.35, 0.11)}`,
  },
  flower: { ar: 1, defs: `<path d="${polar((a) => 0.415 + 0.075 * Math.cos(8 * a))}"/>` },
  leaf: { ar: 1, defs: '<path d="M0 1C0 0.45 0.42 0 1 0 1 0.55 0.58 1 0 1Z"/>' },
  drop: {
    ar: 1,
    defs: '<path d="M0 0H0.5A0.5 0.5 0 0 1 1 0.5 0.5 0.5 0 0 1 0.5 1 0.5 0.5 0 0 1 0 0.5Z"/>',
  },
  squircle: {
    ar: 1,
    defs: `<path d="${polar((a) => 0.5 / (Math.cos(a) ** 4 + Math.sin(a) ** 4) ** 0.25)}"/>`,
  },
  stadium: { ar: 5 / 3, defs: '<rect x="0" y="0" width="1" height="1" rx="0.3" ry="0.5"/>' },
  arch: { ar: 0.82, defs: '<path d="M0 1V0.5C0 0.22 0.22 0 0.5 0 0.78 0 1 0.22 1 0.5V1Z"/>' },
  sail: {
    ar: 1,
    defs: '<path d="M0.5 0.02C0.56 0.02 0.6 0.06 0.64 0.13L0.96 0.8C1 0.88 0.96 0.98 0.86 0.98H0.14C0.04 0.98 0 0.88 0.04 0.8L0.36 0.13C0.4 0.06 0.44 0.02 0.5 0.02Z"/>',
  },
  circle: { ar: 1, defs: '<circle cx="0.5" cy="0.5" r="0.5"/>' },
}
