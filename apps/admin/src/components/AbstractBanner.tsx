import { useMemo } from 'react'

/**
 * An abstract banner drawn on the fly, in the same gentle manner as the generated banners of the public site (events with
 * no photo): soft translucent circles, wide faint rings, dotted arcs, a field of dots and a low wave, in one of our tone
 * families. A different composition each time; light and dark follow because colours are tokens. Decorative only.
 */
type Tone = 'primary' | 'info' | 'gold' | 'clay' | 'success'
const TONES: Tone[] = ['primary', 'info', 'gold', 'clay', 'success']
const MAIN: Record<Tone, string> = {
  primary: 'var(--primary)',
  info: 'var(--info, var(--primary))',
  gold: 'var(--gold)',
  clay: 'var(--clay)',
  success: 'var(--success, var(--primary))',
}
const W = 1200
const H = 480

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function AbstractBanner({ seed }: { seed: number }) {
  const art = useMemo(() => {
    const r = rng(seed)
    const between = (a: number, b: number) => a + r() * (b - a)
    const tone = TONES[Math.floor(r() * TONES.length)] as Tone
    const main = MAIN[tone]
    const palette = ['var(--primary)', 'var(--gold)', 'var(--clay)', main]
    const pick = () => palette[Math.floor(r() * palette.length)] as string
    const circles = Array.from({ length: 4 }, () => ({
      cx: between(0, W),
      cy: between(-40, H + 40),
      r: between(70, 230),
      fill: pick(),
      o: between(0.1, 0.28),
    }))
    const rings = Array.from({ length: 3 }, () => ({
      cx: between(100, W - 100),
      cy: between(40, H - 40),
      r: between(60, 170),
      stroke: pick(),
      w: between(8, 22),
      o: between(0.14, 0.32),
    }))
    const amp = between(30, 70)
    const y0 = between(H * 0.62, H * 0.78)
    const wave = `M0 ${y0.toFixed(0)} C ${W * 0.25} ${(y0 - amp).toFixed(0)}, ${W * 0.5} ${(y0 + amp).toFixed(0)}, ${W * 0.75} ${y0.toFixed(0)} S ${W} ${(y0 - amp / 2).toFixed(0)}, ${W} ${(y0 - amp / 3).toFixed(0)} V ${H} H 0 Z`
    const dots = { x: between(40, W - 380), y: between(30, H - 220), cols: 9, rows: 6, gap: 26 }
    const arcs = Array.from({ length: 2 }, () => ({
      x: between(0, W),
      y: between(0, H),
      r: between(150, 320),
      start: between(0, 360),
    }))
    return { main, circles, rings, wave, dots, arcs }
  }, [seed])
  const { main, circles, rings, wave, dots, arcs } = art
  return (
    <svg
      className="abstract-banner"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width={W}
        height={H}
        style={{ fill: `color-mix(in oklab, ${main} 14%, var(--surface))` }}
      />
      {circles.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative list
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} style={{ fill: c.fill, opacity: c.o }} />
      ))}
      {rings.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative list
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          style={{ fill: 'none', stroke: c.stroke, strokeWidth: c.w, opacity: c.o }}
        />
      ))}
      {arcs.map((a, i) => (
        <path
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative list
          key={i}
          d={`M${a.x + a.r} ${a.y} A ${a.r} ${a.r} 0 0 1 ${a.x} ${a.y + a.r}`}
          transform={`rotate(${a.start} ${a.x} ${a.y})`}
          style={{
            fill: 'none',
            stroke: main,
            strokeWidth: 3,
            strokeDasharray: '2 14',
            strokeLinecap: 'round',
            opacity: 0.4,
          }}
        />
      ))}
      {Array.from({ length: dots.rows }, (_, row) =>
        Array.from({ length: dots.cols }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={dots.x + col * dots.gap}
            cy={dots.y + row * dots.gap}
            r="3"
            style={{ fill: main, opacity: 0.28 }}
          />
        )),
      )}
      <path d={wave} style={{ fill: main, opacity: 0.18 }} />
    </svg>
  )
}
