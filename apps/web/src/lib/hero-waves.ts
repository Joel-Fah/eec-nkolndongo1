/**
 * Soft waves for the Mon espace welcome, adapted from the « ribbons of light » of the social kit (scripts/social-kit.ts): the same
 * seeded sine bands whose thickness swells and thins, but with whole numbers of cycles so the picture tiles without a seam, and drawn
 * in the page's own colours at a low opacity. Built once at build time; the page only slides it (CSS transform).
 */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const WAVE_W = 1200
const H = 300

/** Two layers of bands (they slide at different speeds), each one tile wide; the page repeats the tile. */
export function waveLayers(seed = 20261025): string[] {
  const r = rng(seed)
  const colours = ['--season', '--gold', '--season', '--clay']
  return [0, 1].map((layer) => {
    const bands: string[] = []
    for (let i = 0; i < 4; i++) {
      const base = H * (0.2 + (i + layer * 0.5) * 0.19)
      const amp = H * (0.05 + r() * 0.07)
      const k = 1 + Math.floor(r() * 2)
      const m = 1 + Math.floor(r() * 2)
      const phase = r() * Math.PI * 2
      const thick = H * (0.045 + r() * 0.05)
      const top: string[] = []
      const bottom: string[] = []
      for (let s = 0; s <= 80; s++) {
        const u = s / 80
        const x = u * WAVE_W
        const y = base + amp * Math.sin(u * Math.PI * 2 * k + phase)
        const th = thick * (0.55 + 0.45 * Math.sin(u * Math.PI * 2 * m + phase * 0.5))
        top.push(`${x.toFixed(0)} ${(y - th).toFixed(0)}`)
        bottom.push(`${x.toFixed(0)} ${(y + th).toFixed(0)}`)
      }
      const colour = colours[Math.floor(r() * colours.length)] as string
      const opacity = (0.07 + r() * 0.05).toFixed(2)
      bands.push(
        `<path d="M${top.join(' L')} L${bottom.reverse().join(' L')} Z" style="fill:var(${colour});opacity:${opacity}"/>`,
      )
    }
    return bands.join('')
  })
}
