/**
 * The member card's gentle tilt (decision 0047): it leans a few degrees toward a mouse or pen over it and a soft light follows the
 * pointer. Nothing for touch, and nothing with « reduce motion » (the card then just sits there). Transform only.
 */
export function initMemberCards(root: ParentNode = document) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)')
  for (const card of root.querySelectorAll<HTMLElement>('[data-mcard]')) {
    if (card.dataset.tiltReady) continue
    card.dataset.tiltReady = '1'
    card.addEventListener('pointermove', (e) => {
      if (calm.matches || e.pointerType === 'touch') return
      const r = card.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      card.dataset.tilting = ''
      card.style.setProperty('--ry', `${((x - 0.5) * 10).toFixed(2)}deg`)
      card.style.setProperty('--rx', `${((0.5 - y) * 8).toFixed(2)}deg`)
      card.style.setProperty('--mx', `${(x * 100).toFixed(0)}%`)
      card.style.setProperty('--my', `${(y * 100).toFixed(0)}%`)
    })
    card.addEventListener('pointerleave', () => {
      delete card.dataset.tilting
      card.style.setProperty('--rx', '0deg')
      card.style.setProperty('--ry', '0deg')
    })
  }
}
