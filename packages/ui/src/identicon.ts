/**
 * A generated abstract avatar, the way GitHub draws one for people with no picture: a mirrored 5 × 5 pattern of rounded cells in one of
 * our tone families on a soft tint of it. Same seed, same picture; colours are theme tokens, so light and dark follow. Decorative
 * (the person's name is always next to it). Returns a complete `<svg>`; round it with CSS (`border-radius: 50%`).
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

export function identiconSvg(seed: number, className = 'identicon'): string {
  const r = rng(seed)
  const main = TONES[Math.floor(r() * TONES.length)] as string
  const cells: string[] = []
  // Columns 0–2 are drawn, 3–4 mirror 1–0: a calm, symmetric shape that is never empty.
  const on: boolean[][] = Array.from({ length: 5 }, () => [r() > 0.5, r() > 0.5, r() > 0.45])
  if (!on.some((row) => row.some(Boolean))) (on[2] as boolean[])[2] = true
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      const src = x < 3 ? x : 4 - x
      if ((on[y] as boolean[])[src])
        cells.push(
          `<rect x="${14 + x * 14.4}" y="${14 + y * 14.4}" width="13" height="13" rx="4"/>`,
        )
    }
  return `<svg class="${className}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><rect width="100" height="100" style="fill:color-mix(in oklab, ${main} 16%, var(--surface, #fff))"/><g style="fill:${main}">${cells.join('')}</g></svg>`
}
