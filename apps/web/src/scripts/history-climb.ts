/**
 * « Gravir la colline »: a winding trail drawn through the milestones as you scroll (GSAP ScrollTrigger, loaded only
 * here), each milestone opening on tap. Without JavaScript, with reduced motion or with Save-Data it is a plain
 * timeline with the trail already drawn. No pinning: it is only ever a normal scroll.
 */
const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

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
  // A smooth S between each pair of points: out of the first downwards, into the next from above.
  let d = `M ${pts[0]?.[0]} ${pts[0]?.[1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1] as readonly [number, number]
    const [x1, y1] = pts[i] as readonly [number, number]
    const my = (y0 + y1) / 2
    d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`
  }
  path.setAttribute('d', d)
  return path
}

export async function initClimb() {
  const root = document.querySelector<HTMLElement>('[data-climb]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  root.setAttribute('data-js', '')

  // Closed to start with (they are open without script, so nothing is ever hidden from anyone).
  for (const panel of root.querySelectorAll<HTMLElement>('[data-panel]')) panel.hidden = true

  // Tap to open: each milestone is a button controlling its own text.
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-open]')) {
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true'
      b.setAttribute('aria-expanded', String(open))
      const panel = document.getElementById(b.getAttribute('aria-controls') ?? '')
      if (panel) panel.hidden = !open
    })
  }

  let path = trail(root)
  if (!path) return
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
        end: 'bottom 60%',
        scrub: 0.6,
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
  window.addEventListener('resize', () => {
    window.clearTimeout(t)
    t = window.setTimeout(() => {
      path = trail(root)
      if (path) {
        const l = path.getTotalLength()
        path.style.strokeDasharray = `${l}`
      }
      ScrollTrigger.refresh()
    }, 200)
  })
}
