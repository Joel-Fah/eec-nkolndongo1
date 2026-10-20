/**
 * The footer playground: little seasonal things (leaves, stars, twigs… see lib/seasonal-art.ts) drift down
 * as the footer comes into view and pile up on the floor. Brush the pointer through them to stir them,
 * sweep upwards to throw them, and they fall back with some weight and a breath of wind; tap for a puff.
 *
 * Plain canvas + a few lines of physics, no dependency. It costs nothing until the footer is near (the
 * caller imports this lazily), sleeps when everything has settled or the footer is off screen, and is a
 * still picture with reduced motion or Save-Data.
 */
import type { Season } from '@eec/core'
import { type ColourToken, gardens, type Motif } from '../lib/seasonal-art'

const GRAVITY = 900
const CELL = 20
const SPRITE = 64
const POINTER_R = 120

type Particle = {
  motif: Motif
  sprite: number
  size: number
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  tilt: number
  phase: number
  freq: number
  drag: number
  state: 'wait' | 'fall' | 'rest'
  at: number
  cell: number
  add: number
}

export function initPlayground(root: HTMLElement): () => void {
  const canvas = root.querySelector('canvas')
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return () => {}
  const canvasEl = canvas
  const still =
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  const lowEnd =
    (navigator.hardwareConcurrency ?? 8) <= 4 ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2
  const rootEl = document.documentElement

  let W = 0
  let H = 0
  let dpr = 1
  let sprites: HTMLCanvasElement[] = []
  let spriteOf: { motif: Motif; colour: number; index: number }[] = []
  let particles: Particle[] = []
  let heights: number[] = []
  let raf = 0
  let last = 0
  let visible = true
  let alive = true
  let t = 0

  // ── Colours and sprites ────────────────────────────────────────────────────────────────────────
  const probe = document.createElement('span')
  probe.style.display = 'none'
  root.append(probe)
  const resolve = (name: string) => {
    probe.style.color = `var(--${name})`
    return getComputedStyle(probe).color
  }
  const season = () =>
    (rootEl.dataset.season as Season) in gardens ? (rootEl.dataset.season as Season) : 'ordinaire'

  function buildSprites() {
    const garden = gardens[season()]
    const ink = resolve('ink')
    const surface = resolve('surface')
    const colours = garden.colours.map((c: ColourToken) => resolve(c))
    sprites = []
    spriteOf = []
    for (const motif of garden.motifs) {
      colours.forEach((colour, ci) => {
        const c = document.createElement('canvas')
        c.width = c.height = Math.round(SPRITE * dpr)
        const g = c.getContext('2d')
        if (!g) return
        g.scale((SPRITE / 100) * dpr, (SPRITE / 100) * dpr)
        g.lineCap = g.lineJoin = 'round'
        if (motif.fill) {
          g.fillStyle = colour
          g.fill(motif.fill)
        }
        if (motif.line) {
          g.strokeStyle = colour
          g.lineWidth = motif.line.width
          g.stroke(motif.line.path)
        }
        if (motif.glow) {
          g.globalAlpha = 0.45
          g.fillStyle = surface
          g.fill(motif.glow)
          g.globalAlpha = 1
        }
        if (motif.detail) {
          g.globalAlpha = 0.3
          g.strokeStyle = ink
          g.lineWidth = motif.detail.width
          g.stroke(motif.detail.path)
        }
        spriteOf.push({ motif, colour: ci, index: sprites.length })
        sprites.push(c)
      })
    }
  }

  const pick = (): { motif: Motif; index: number } => {
    const total = spriteOf.reduce((n, s) => n + s.motif.share, 0)
    let r = Math.random() * total
    for (const s of spriteOf) {
      r -= s.motif.share
      if (r <= 0) return s
    }
    return spriteOf[0] as (typeof spriteOf)[number]
  }

  function make(i: number, count: number, delay: number): Particle {
    const { motif, index } = pick()
    const [lo, hi] = motif.size.map((n) => n * 1.35) as [number, number]
    const size = lo + Math.random() * (hi - lo)
    return {
      motif,
      sprite: index,
      size,
      x: Math.random() * W,
      y: -size,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      spin: 0,
      tilt: Math.random() * 6,
      phase: Math.random() * 6.28,
      freq: 1.4 + Math.random() * 1.6,
      drag: 1.5 + motif.weight * 1.6 + Math.random() * 0.5,
      state: 'wait',
      at: (i / count) * delay + Math.random() * 0.6,
      cell: 0,
      add: 0,
    }
  }

  // ── The floor ────────────────────────────────────────────────────────────────────────────────
  const cols = () => Math.ceil(W / CELL) + 1
  const pileMax = () => H * 0.34
  const floorAt = (x: number) =>
    H - (heights[Math.min(heights.length - 1, Math.max(0, Math.floor(x / CELL)))] ?? 0)

  function land(p: Particle) {
    const c = Math.min(heights.length - 1, Math.max(0, Math.floor(p.x / CELL)))
    p.state = 'rest'
    p.vx = p.vy = p.spin = 0
    p.y = Math.min(H - p.size * 0.12, floorAt(p.x) - p.size * 0.1)
    p.cell = c
    p.add = Math.max(0, Math.min(p.size * 0.12, pileMax() - (heights[c] ?? 0)))
    for (const [d, k] of [
      [0, 1],
      [-1, 0.55],
      [1, 0.55],
    ] as const) {
      const i = c + d
      if (heights[i] !== undefined) heights[i] = (heights[i] as number) + p.add * k
    }
  }

  function wake(p: Particle) {
    if (p.state !== 'rest') return
    for (const [d, k] of [
      [0, 1],
      [-1, 0.55],
      [1, 0.55],
    ] as const) {
      const i = p.cell + d
      if (heights[i] !== undefined) heights[i] = Math.max(0, (heights[i] as number) - p.add * k)
    }
    p.state = 'fall'
    p.tilt = Math.random() * 6
  }

  // ── The pointer ─────────────────────────────────────────────────────────────────────────────
  const pointer = { x: -999, y: -999, vx: 0, vy: 0, at: 0, seen: false }
  let burst: { x: number; y: number } | null = null

  function step(dt: number) {
    t += dt
    const wind = 26 * Math.sin(t * 0.37) + 14 * Math.sin(t * 1.13 + 2)
    const moving = Math.hypot(pointer.vx, pointer.vy)
    for (const p of particles) {
      if (p.state === 'wait') {
        if (t < p.at) continue
        p.state = 'fall'
        p.vx = (Math.random() - 0.5) * 30
      }
      if (p.state === 'rest') {
        // Something that rested on a pile that has been disturbed drops again.
        if (floorAt(p.x) - p.size * 0.1 - p.y > 6) wake(p)
        else if (moving < 30 && !burst) continue
      }
      const dx = p.x - pointer.x
      const dy = p.y - pointer.y
      const near = dx * dx + dy * dy < POINTER_R * POINTER_R
      if (near && moving > 30) {
        const d = Math.max(8, Math.hypot(dx, dy))
        const f = (1 - d / POINTER_R) ** 2 / (0.4 + p.motif.weight)
        wake(p)
        p.vx += (pointer.vx * 0.42 + (dx / d) * 280) * f
        p.vy += (pointer.vy * 0.42 + (dy / d) * 280) * f
        p.spin += (Math.random() - 0.5) * 14 * f
      }
      if (burst) {
        const bx = p.x - burst.x
        const by = p.y - burst.y
        const d = Math.max(10, Math.hypot(bx, by))
        if (d < POINTER_R * 1.5) {
          const f = (1 - d / (POINTER_R * 1.5)) ** 1.5 / (0.4 + p.motif.weight)
          wake(p)
          p.vx += (bx / d) * 520 * f
          p.vy += (by / d) * 520 * f - 380 * f
          p.spin += (Math.random() - 0.5) * 18 * f
        }
      }
      if (p.state !== 'fall') continue
      // Weight pulls down, the air holds back (terminal speed ≈ g·w / drag); leaves sway as they fall.
      const falling = p.vy > 0 ? 1 : 0.35
      p.vy += (GRAVITY * (0.25 + p.motif.weight) - p.vy * p.drag * 3.2) * dt
      p.vx +=
        ((wind - p.vx) * 0.9 + Math.sin(t * p.freq + p.phase) * 150 * p.motif.flutter * falling) *
        dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.tilt += (2.2 + Math.abs(p.vx) * 0.02 + Math.abs(p.spin)) * dt
      p.spin +=
        ((p.vx * 0.012 + Math.sin(t * p.freq + p.phase) * 0.9) * p.motif.flutter - p.spin) *
        Math.min(1, 2.2 * dt)
      p.angle += p.spin * dt
      if (p.x < 0 || p.x > W) {
        p.x = Math.min(W, Math.max(0, p.x))
        p.vx *= -0.4
      }
      if (p.y > floorAt(p.x) - p.size * 0.1 && p.vy > 0) land(p)
    }
    burst = null
    pointer.vx *= 0.86
    pointer.vy *= 0.86
  }

  function draw() {
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx?.clearRect(0, 0, W, H)
    for (const p of particles) {
      if (p.state === 'wait' || !ctx) continue
      const sprite = sprites[p.sprite]
      if (!sprite) continue
      const flip = p.state === 'rest' ? 0.85 : 0.4 + 0.6 * Math.abs(Math.cos(p.tilt))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.scale((p.size / SPRITE) * flip, p.size / SPRITE)
      ctx.drawImage(sprite, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE)
      ctx.restore()
    }
  }

  const busy = () =>
    particles.some((p) => p.state === 'fall' || p.state === 'wait') ||
    Math.hypot(pointer.vx, pointer.vy) > 30 ||
    burst

  function frame(now: number) {
    raf = 0
    if (!alive || !root.isConnected) return dispose()
    if (!visible) return
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60)
    last = now
    step(dt)
    draw()
    if (busy()) raf = requestAnimationFrame(frame)
  }
  const wakeLoop = () => {
    if (still || raf || !visible || !alive) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  // ── Size, start ───────────────────────────────────────────────────────────────────────────────
  function resize() {
    const r = root.getBoundingClientRect()
    if (!r.width || !r.height) return
    const oldW = W
    dpr = Math.min(2, window.devicePixelRatio || 1)
    W = r.width
    H = r.height
    canvasEl.width = Math.round(W * dpr)
    canvasEl.height = Math.round(H * dpr)
    heights = new Array(cols()).fill(0)
    for (const p of particles) {
      if (oldW) p.x *= W / oldW
      if (p.state === 'rest') p.state = 'fall'
    }
    buildSprites()
    wakeLoop()
    if (still) settleNow()
  }

  /** A still picture: run the fall without drawing and show the pile. */
  function settleNow() {
    for (const p of particles) {
      p.state = 'wait'
      p.at = 0
      p.y = -p.size
    }
    for (let i = 0; i < 1500 && particles.some((p) => p.state !== 'rest'); i++) step(1 / 30)
    draw()
  }

  buildSprites()
  const count = Math.round(Math.min(110, Math.max(34, innerWidth / 11)) * (lowEnd ? 0.6 : 1))
  resize()
  particles = Array.from({ length: count }, (_, i) => make(i, count, 6))
  particles.sort((a, b) => a.size - b.size)
  if (still) settleNow()
  else wakeLoop()

  // ── Events ────────────────────────────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(resize)
  ro.observe(root)
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    if (visible) wakeLoop()
  })
  io.observe(root)
  const mo = new MutationObserver(() => {
    // Season or theme changed: the same pieces, drawn from the new garden.
    buildSprites()
    for (const p of particles) {
      const { motif, index } = pick()
      p.motif = motif
      p.sprite = index
    }
    if (still) draw()
    else wakeLoop()
  })
  mo.observe(rootEl, { attributes: true, attributeFilter: ['data-season', 'data-theme'] })

  const local = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onMove = (e: PointerEvent) => {
    if (still) return
    const { x, y } = local(e)
    const now = e.timeStamp
    if (pointer.seen && now > pointer.at) {
      const s = 1000 / Math.max(8, now - pointer.at)
      pointer.vx = Math.max(-2600, Math.min(2600, (x - pointer.x) * s))
      pointer.vy = Math.max(-2600, Math.min(2600, (y - pointer.y) * s))
    }
    pointer.x = x
    pointer.y = y
    pointer.at = now
    pointer.seen = true
    root.classList.add('is-played')
    wakeLoop()
  }
  const onLeave = () => {
    pointer.x = pointer.y = -999
    pointer.seen = false
  }
  const onDown = (e: PointerEvent) => {
    if (still) return
    burst = local(e)
    root.classList.add('is-played')
    wakeLoop()
  }
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerleave', onLeave)
  root.addEventListener('pointerdown', onDown)

  function dispose() {
    alive = false
    cancelAnimationFrame(raf)
    ro.disconnect()
    io.disconnect()
    mo.disconnect()
    root.removeEventListener('pointermove', onMove)
    root.removeEventListener('pointerleave', onLeave)
    root.removeEventListener('pointerdown', onDown)
    probe.remove()
  }
  return dispose
}
