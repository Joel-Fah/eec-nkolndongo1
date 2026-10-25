/**
 * The generated avatar, drawn in our own language (the same family as the abstract banners): a soft tint of one of our tones, two or
 * three big translucent circles, a wide faint ring, a small dotted arc and a low wave. Same seed, same picture; colours are theme
 * tokens, so light and dark follow. The drawing is square and fills its box: the container decides the shape (rounded square in the
 * header, circle in the admin bar), so it is never a circle inside a circle. Decorative: the person's name is always next to it.
 */
const TONES = ['var(--primary)', 'var(--gold)', 'var(--clay)', 'var(--info, var(--primary))']

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function avatarSvg(seed: number, className = 'avatar-art'): string {
  const r = rng(seed)
  const between = (a: number, b: number) => a + r() * (b - a)
  const i = Math.floor(r() * TONES.length)
  const main = TONES[i] as string
  const palette = [TONES[0], TONES[1], TONES[2], main] as string[]
  const pick = () => palette[Math.floor(r() * palette.length)] as string
  const shapes: string[] = []
  for (let n = 0; n < 3; n++)
    shapes.push(
      `<circle cx="${between(10, 90).toFixed(0)}" cy="${between(5, 70).toFixed(0)}" r="${between(22, 46).toFixed(0)}" style="fill:${pick()};opacity:${between(0.2, 0.42).toFixed(2)}"/>`,
    )
  shapes.push(
    `<circle cx="${between(25, 75).toFixed(0)}" cy="${between(25, 75).toFixed(0)}" r="${between(18, 34).toFixed(0)}" style="fill:none;stroke:${pick()};stroke-width:${between(3, 6).toFixed(1)};opacity:${between(0.3, 0.5).toFixed(2)}"/>`,
  )
  const amp = between(6, 13)
  const y0 = between(62, 80)
  shapes.push(
    `<path d="M0 ${y0.toFixed(0)} C 25 ${(y0 - amp).toFixed(0)}, 50 ${(y0 + amp).toFixed(0)}, 75 ${y0.toFixed(0)} S 100 ${(y0 - amp / 2).toFixed(0)}, 100 ${(y0 - amp / 3).toFixed(0)} V 100 H 0 Z" style="fill:${main};opacity:0.34"/>`,
  )
  shapes.push(
    `<circle cx="${between(70, 88).toFixed(0)}" cy="${between(12, 28).toFixed(0)}" r="3.2" style="fill:var(--gold);opacity:0.95"/>`,
  )
  return `<svg class="${className}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="100" height="100" style="fill:color-mix(in oklab, ${main} 18%, var(--surface, #fff))"/>${shapes.join('')}</svg>`
}
