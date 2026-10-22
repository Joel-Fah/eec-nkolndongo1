import { useMemo } from 'react'

/**
 * An abstract banner drawn on the fly: a different composition and palette each time (waves, rings, dots, blocks, arcs,
 * stripes), always from our colour tokens so it follows light and dark. Decorative only (aria-hidden); nothing is stored.
 * Used above the help sheet; usable for any panel that wants a header image without a photo.
 */
type Tone = 'primary' | 'gold' | 'clay' | 'info' | 'success'
const PALETTES: Tone[][] = [
  ['primary', 'gold', 'success'],
  ['info', 'clay', 'gold'],
  ['clay', 'primary', 'gold'],
  ['success', 'info', 'primary'],
  ['gold', 'primary', 'clay'],
]
const W = 480
const H = 190

/** A small seeded random generator (mulberry32). */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const c = (t: Tone) => `var(--${t})`

function wave(r: () => number, y: number, amp: number) {
  const pts = Array.from({ length: 5 }, (_, i) => [(i * W) / 4, y + (r() - 0.5) * amp * 2])
  let d = `M0 ${H}L0 ${pts[0]?.[1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1] as number[]
    const [x1, y1] = pts[i] as number[]
    const mx = ((x0 ?? 0) + (x1 ?? 0)) / 2
    d += `C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`
  }
  return `${d}L${W} ${H}Z`
}

function scene(style: number, r: () => number, p: Tone[]) {
  const [a, b, d] = p as [Tone, Tone, Tone]
  switch (style) {
    case 0: // waves + sun
      return (
        <>
          <circle
            cx={90 + r() * 300}
            cy={60 + r() * 30}
            r={34 + r() * 22}
            fill={c(b)}
            opacity=".85"
          />
          <path d={wave(r, 120, 18)} fill={c(a)} opacity=".35" />
          <path d={wave(r, 140, 16)} fill={c(d)} opacity=".45" />
          <path d={wave(r, 162, 12)} fill={c(a)} opacity=".6" />
        </>
      )
    case 1: {
      // rings
      const cx = 120 + r() * 240
      const cy = 70 + r() * 60
      return (
        <>
          {[110, 86, 62, 40, 20].map((rad, i) => (
            <circle
              key={rad}
              cx={cx}
              cy={cy}
              r={rad}
              fill={i % 2 ? c(b) : 'none'}
              stroke={c(i % 2 ? d : a)}
              strokeWidth={i % 2 ? 0 : 10}
              opacity={0.25 + i * 0.12}
            />
          ))}
        </>
      )
    }
    case 2: {
      // dot grid + disc
      const dots = []
      for (let x = 14; x < W; x += 26)
        for (let y = 14; y < H; y += 26)
          dots.push(
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={2.2}
              fill={c(a)}
              opacity={0.15 + (x / W) * 0.5}
            />,
          )
      return (
        <>
          {dots}
          <circle
            cx={300 + r() * 120}
            cy={60 + r() * 70}
            r={50 + r() * 20}
            fill={c(b)}
            opacity=".8"
          />
          <circle
            cx={90 + r() * 90}
            cy={100 + r() * 60}
            r={26 + r() * 14}
            fill={c(d)}
            opacity=".7"
          />
        </>
      )
    }
    case 3: {
      // rounded blocks
      const blocks = []
      for (let i = 0; i < 9; i++) {
        const w = 46 + r() * 70
        const h = 30 + r() * 60
        blocks.push(
          <rect
            key={i}
            x={(i % 5) * 100 - 10 + r() * 30}
            y={Math.floor(i / 5) * 90 + r() * 30}
            width={w}
            height={h}
            rx={14 + r() * 12}
            fill={c([a, b, d][Math.floor(r() * 3)] as Tone)}
            opacity={0.35 + r() * 0.5}
          />,
        )
      }
      return <>{blocks}</>
    }
    case 4: {
      // arcs (a rainbow)
      const cx = 140 + r() * 200
      return (
        <>
          {[130, 104, 78, 52].map((rad, i) => (
            <path
              key={rad}
              d={`M${cx - rad} ${H}A${rad} ${rad} 0 0 1 ${cx + rad} ${H}`}
              fill="none"
              stroke={c([a, b, d, a][i] as Tone)}
              strokeWidth="18"
              strokeLinecap="round"
              opacity={0.5 + i * 0.12}
            />
          ))}
          <circle cx={30 + r() * 60} cy={40 + r() * 30} r="14" fill={c(b)} opacity=".8" />
        </>
      )
    }
    default: {
      // diagonal stripes
      return (
        <>
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={-60 + i * 80 + r() * 20}
              y={-40}
              width={32 + r() * 26}
              height={300}
              rx="16"
              transform="rotate(24 240 95)"
              fill={c([a, b, d][i % 3] as Tone)}
              opacity={0.3 + r() * 0.45}
            />
          ))}
        </>
      )
    }
  }
}

export function AbstractBanner({ seed }: { seed: number }) {
  const art = useMemo(() => {
    const r = rng(seed)
    const palette = PALETTES[Math.floor(r() * PALETTES.length)] as Tone[]
    const style = Math.floor(r() * 6)
    return { style, palette, node: scene(style, r, palette) }
  }, [seed])
  return (
    <svg
      className="abstract-banner"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-style={art.style}
    >
      <rect width={W} height={H} fill="var(--surface-2)" />
      <rect width={W} height={H} fill={c(art.palette[0] as Tone)} opacity=".08" />
      {art.node}
    </svg>
  )
}
