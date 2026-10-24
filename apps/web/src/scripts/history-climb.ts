/**
 * « Gravir la colline »: a winding trail drawn through the milestones as you scroll (GSAP ScrollTrigger, loaded only
 * here), each milestone opening on tap. Without JavaScript, with reduced motion or with Save-Data it is a plain
 * timeline with the trail already drawn. No pinning: it is only ever a normal scroll.
 */
const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

/** A small seeded generator (mulberry32): the same wandering every time. */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function trail(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('[data-trail]')
  const path = root.querySelector<SVGPathElement>('[data-trail-path]')
  const dots = [...root.querySelectorAll<HTMLElement>('[data-node]')]
  if (!svg || !path || dots.length < 2) return null
  const box = root.getBoundingClientRect()
  const pts = dots.map((d) => {
    const r = d.getBoundingClientRect()
    return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2] as const
  })
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
  svg.setAttribute('width', String(box.width))
  svg.setAttribute('height', String(box.height))
  // The trail passes through every step once, in order, but wanders between them: each stretch bends its own way and now and
  // then makes a loop before moving on. The wandering is seeded from the step's number, so it is the same on every visit.
  const wide = box.width > 760
  const r = wide ? 44 : 20
  let d = `M ${pts[0]?.[0]} ${pts[0]?.[1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1] as readonly [number, number]
    const [x1, y1] = pts[i] as readonly [number, number]
    const rnd = rng(i * 7919 + 13)
    const my = (y0 + y1) / 2
    const dir = rnd() < 0.5 ? -1 : 1
    if (y1 - y0 > r * 6 && rnd() < 0.7) {
      // Down to a point beside the middle, a teardrop loop there, then on to the step.
      const mx = (x0 + x1) / 2 + dir * r * (0.6 + rnd())
      d += ` C ${x0} ${y0 + (my - y0) * 0.6}, ${mx - dir * r} ${my - r * 1.6}, ${mx} ${my - r * 0.4}`
      d += ` C ${mx + dir * r * 1.9} ${my + r * 0.9}, ${mx + dir * r * 1.9} ${my - r * 1.7}, ${mx} ${my - r * 0.2}`
      d += ` C ${mx - dir * r * 0.8} ${my + r * 0.8}, ${x1} ${my + (y1 - my) * 0.4}, ${x1} ${y1}`
    } else {
      const bend = dir * r * (0.5 + rnd() * 1.5)
      d += ` C ${x0 + bend} ${my}, ${x1 - bend} ${my}, ${x1} ${y1}`
    }
  }
  path.setAttribute('d', d)
  return path
}

export async function initClimb() {
  const root = document.querySelector<HTMLElement>('[data-climb]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  root.setAttribute('data-js', '')

  // The steps are always open: the trail goes through them, and a step that folds would move it.

  let path = trail(root)
  if (!path) return
  const dots = [...root.querySelectorAll<HTMLElement>('[data-node]')]
  const len = path.getTotalLength()
  path.style.strokeDasharray = `${len}`
  path.style.strokeDashoffset = reduced() ? '0' : `${len}`
  if (reduced()) return

  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ])
  gsap.registerPlugin(ScrollTrigger)
  const mm = gsap.matchMedia()
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const draw = gsap.to(path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top 70%',
        // The trail reaches the last step while it is still comfortably on screen, not after it has scrolled away.
        endTrigger: dots.at(-1) ?? root,
        end: 'top 65%',
        scrub: 0.25,
        invalidateOnRefresh: true,
      },
    })
    const items = gsap.utils.toArray<HTMLElement>('[data-milestone]', root)
    for (const el of items) {
      gsap.from(el, {
        autoAlpha: 0,
        y: 24,
        duration: 0.5,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      })
    }
    return () => {
      draw.kill()
    }
  })
  let t: number | undefined
  const redraw = () => {
    window.clearTimeout(t)
    t = window.setTimeout(() => {
      path = trail(root)
      if (path) {
        const l = path.getTotalLength()
        path.style.strokeDasharray = `${l}`
      }
      ScrollTrigger.refresh()
    }, 200)
  }
  window.addEventListener('resize', redraw)
  // Pictures arriving change the steps' heights: draw the trail again.
  new ResizeObserver(redraw).observe(root)
}
