/**
 * The abstract banner as a pure function: soft translucent circles, wide faint rings, dotted arcs, a field of dots and a low
 * wave in one of our tone families, for a seed. Returns SVG markup at any size, with colours given by the caller (CSS
 * variables for the admin, so themes follow; hex values for the social kit's PNG files). Same seed, same picture.
 * Decorative only.
 */
export type Tone = 'primary' | 'info' | 'gold' | 'clay' | 'success'
export const TONES: Tone[] = ['primary', 'info', 'gold', 'clay', 'success']
export type ArtColors = Record<Tone, string> & { surface: string }

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inner SVG markup (no <svg> wrapper) for a `width` × `height` canvas. Shapes scale with the height (480 is the reference). */
export function abstractArt({
  seed,
  width,
  height,
  colors,
  tone,
}: {
  seed: number
  width: number
  height: number
  colors: ArtColors
  /** Force a tone family; by default one is drawn from the seed. */
  tone?: Tone
}): string {
  const r = rng(seed)
  const W = width
  const H = height
  const k = H / 480
  const between = (a: number, b: number) => a + r() * (b - a)
  const drawn = TONES[Math.floor(r() * TONES.length)] as Tone
  const main = colors[tone ?? drawn]
  const palette = [colors.primary, colors.gold, colors.clay, main]
  const pick = () => palette[Math.floor(r() * palette.length)] as string
  // More shapes on a wider canvas, so a banner is as lively as the 1200 × 480 reference.
  const more = Math.max(1, Math.round(W / (H * 2.5)))
  const out: string[] = [
    `<rect width="${W}" height="${H}" style="fill:color-mix(in oklab, ${main} 14%, ${colors.surface})"/>`,
  ]
  for (let i = 0; i < 4 * more; i++) {
    const cx = between(0, W)
    const cy = between(-40 * k, H + 40 * k)
    const rad = between(70 * k, 230 * k)
    out.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" style="fill:${pick()};opacity:${between(0.1, 0.28).toFixed(2)}"/>`,
    )
  }
  for (let i = 0; i < 3 * more; i++) {
    const cx = between(100 * k, W - 100 * k)
    const cy = between(40 * k, H - 40 * k)
    const rad = between(60 * k, 170 * k)
    out.push(
      `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" style="fill:none;stroke:${pick()};stroke-width:${between(8 * k, 22 * k).toFixed(1)};opacity:${between(0.14, 0.32).toFixed(2)}"/>`,
    )
  }
  for (let i = 0; i < 2 * more; i++) {
    const x = between(0, W)
    const y = between(0, H)
    const rad = between(150 * k, 320 * k)
    out.push(
      `<path d="M${(x + rad).toFixed(0)} ${y.toFixed(0)} A ${rad.toFixed(0)} ${rad.toFixed(0)} 0 0 1 ${x.toFixed(0)} ${(y + rad).toFixed(0)}" transform="rotate(${between(0, 360).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" style="fill:none;stroke:${main};stroke-width:${(3 * k).toFixed(1)};stroke-dasharray:${(2 * k).toFixed(1)} ${(14 * k).toFixed(1)};stroke-linecap:round;opacity:0.4"/>`,
    )
  }
  const gap = 26 * k
  for (let d = 0; d < more; d++) {
    const x0 = between(40 * k, Math.max(41 * k, W - 380 * k))
    const y0 = between(30 * k, Math.max(31 * k, H - 220 * k))
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 9; col++)
        out.push(
          `<circle cx="${(x0 + col * gap).toFixed(0)}" cy="${(y0 + row * gap).toFixed(0)}" r="${(3 * k).toFixed(1)}" style="fill:${main};opacity:0.28"/>`,
        )
  }
  const amp = between(30 * k, 70 * k)
  const yw = between(H * 0.62, H * 0.78)
  out.push(
    `<path d="M0 ${yw.toFixed(0)} C ${(W * 0.25).toFixed(0)} ${(yw - amp).toFixed(0)}, ${(W * 0.5).toFixed(0)} ${(yw + amp).toFixed(0)}, ${(W * 0.75).toFixed(0)} ${yw.toFixed(0)} S ${W} ${(yw - amp / 2).toFixed(0)}, ${W} ${(yw - amp / 3).toFixed(0)} V ${H} H 0 Z" style="fill:${main};opacity:0.18"/>`,
  )
  return out.join('')
}

/** A whole `<svg>` for the admin: colours are the theme's variables. */
export const THEME_COLORS: ArtColors = {
  primary: 'var(--primary)',
  info: 'var(--info, var(--primary))',
  gold: 'var(--gold)',
  clay: 'var(--clay)',
  success: 'var(--success, var(--primary))',
  surface: 'var(--surface)',
}
