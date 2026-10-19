/**
 * Gentle idle animation for inline illustrations ([data-illustration][data-animate]).
 * Loaded only by pages that use it; GSAP is imported dynamically. Still with reduced motion or
 * Save-Data; paused when off-screen; reverted before page swaps.
 */
import { duration, ease, media, prefersSaveData } from '@eec/ui/motion'

export async function animateIllustrations() {
  const svgs = [...document.querySelectorAll<SVGSVGElement>('svg[data-illustration][data-animate]')]
  // Nothing to animate for reduced motion or data saver: don't even download GSAP.
  if (!svgs.length || prefersSaveData() || matchMedia(media.reduced).matches) return

  const { gsap } = await import('gsap')
  const mm = gsap.matchMedia()

  mm.add(media.full, () => {
    const observers: IntersectionObserver[] = []
    for (const svg of svgs) {
      const part = (name: string) => svg.querySelectorAll(`[data-part="${name}"]`)
      const tl = gsap.timeline({ repeat: -1, defaults: { ease: ease.idle } })
      const notes = ['note-1', 'note-2', 'note-3'].flatMap((n) => [...part(n)])
      notes.forEach((note, i) => {
        gsap.to(note, {
          y: -6 - i * 2,
          rotation: i % 2 ? 6 : -5,
          transformOrigin: '50% 100%',
          duration: 2.2 + i * 0.5,
          ease: ease.idle,
          yoyo: true,
          repeat: -1,
          delay: i * 0.4,
        })
      })
      gsap.to(svg.querySelectorAll('[data-part="marks"] > *'), {
        scale: 0.6,
        opacity: 0.5,
        transformOrigin: '50% 50%',
        duration: duration.story * 1.6,
        ease: ease.idle,
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.35, from: 'random' },
      })
      tl.to(part('receiver'), { x: -3, y: 2, duration: 2.4 }).to(part('receiver'), {
        x: 0,
        y: 0,
        duration: 2.4,
      })

      // Only run while visible: saves battery on phones.
      const all = gsap.getTweensOf(svg.querySelectorAll('*'))
      const observer = new IntersectionObserver(([entry]) => {
        const run = entry?.isIntersecting ?? false
        for (const tween of [...all, tl]) run ? tween.resume() : tween.pause()
      })
      observer.observe(svg)
      observers.push(observer)
    }
    return () => {
      for (const observer of observers) observer.disconnect()
    }
  })

  document.addEventListener('astro:before-swap', () => mm.revert(), { once: true })
}
