/**
 * The sermon video is a « facade »: a button on our own artwork. Nothing is requested from YouTube until the visitor presses
 * play, and then only the privacy-enhanced player (youtube-nocookie.com) is loaded, in place (decision 0034).
 */
export function initSermonVideo() {
  for (const box of document.querySelectorAll<HTMLElement>('[data-sermon-video]')) {
    if (box.dataset.bound) continue
    box.dataset.bound = '1'
    const button = box.querySelector<HTMLButtonElement>('button')
    button?.addEventListener('click', () => {
      const id = box.dataset.id ?? ''
      if (!/^[\w-]{11}$/.test(id)) return
      const frame = document.createElement('iframe')
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
      frame.title = box.dataset.title ?? ''
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
      frame.allowFullscreen = true
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      frame.className = 'sv-frame'
      box.replaceChildren(frame)
      frame.focus()
    })
  }
}
