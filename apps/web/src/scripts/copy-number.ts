/** « Copier le numéro »: copies the text of the target to the clipboard and says so for a moment. */
export function initCopy() {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    if (b.dataset.ready) continue
    b.dataset.ready = '1'
    b.addEventListener('click', async () => {
      const text = b.dataset.copy ?? ''
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Older browsers: select a temporary field.
        const t = document.createElement('textarea')
        t.value = text
        t.setAttribute('readonly', '')
        t.style.position = 'fixed'
        t.style.opacity = '0'
        document.body.append(t)
        t.select()
        document.execCommand('copy')
        t.remove()
      }
      const label = b.querySelector<HTMLElement>('[data-copy-label]')
      const before = label?.textContent ?? ''
      if (label) label.textContent = b.dataset.copied ?? before
      window.setTimeout(() => {
        if (label) label.textContent = before
      }, 1800)
    })
  }
}
