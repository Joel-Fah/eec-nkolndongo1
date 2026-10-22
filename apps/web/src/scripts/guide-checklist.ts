/**
 * A guide as a checklist: ticks are kept in this browser only (localStorage, never sent), the progress follows, the
 * list can be printed (every step opened for the print) and cleared. Without JavaScript it is a plain list of steps.
 */
const read = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
const write = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Private mode or blocked storage: the ticks simply do not persist.
  }
}

export function initGuide() {
  const root = document.querySelector<HTMLElement>('[data-guide]')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  const key = `eec-guide:${root.dataset.guide}`
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input[data-step]')]
  const bar = root.querySelector<HTMLElement>('[data-progress]')
  const text = root.querySelector<HTMLElement>('[data-progress-text]')
  const fill = root.querySelector<HTMLElement>('[data-progress-fill]')
  const done = new Set(read(key))
  const paint = () => {
    for (const b of boxes) {
      const on = done.has(b.dataset.step ?? '')
      b.checked = on
      b.closest('li')?.toggleAttribute('data-done', on)
    }
    const n = boxes.filter((b) => b.checked).length
    if (bar) bar.setAttribute('aria-valuenow', String(n))
    if (fill) fill.style.width = `${boxes.length ? (n / boxes.length) * 100 : 0}%`
    if (text)
      text.textContent = (root.dataset.progressLabel ?? '')
        .replace('{done}', String(n))
        .replace('{total}', String(boxes.length))
    root.toggleAttribute('data-complete', boxes.length > 0 && n === boxes.length)
  }
  for (const b of boxes) {
    b.disabled = false
    b.addEventListener('change', () => {
      if (b.checked) done.add(b.dataset.step ?? '')
      else done.delete(b.dataset.step ?? '')
      write(key, [...done])
      paint()
    })
  }
  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    done.clear()
    write(key, [])
    paint()
  })
  root.querySelector('[data-print]')?.addEventListener('click', () => window.print())
  // Every step is opened for the printed copy, then put back.
  let opened: HTMLDetailsElement[] = []
  window.addEventListener('beforeprint', () => {
    opened = [...root.querySelectorAll<HTMLDetailsElement>('details:not([open])')]
    for (const d of opened) d.open = true
  })
  window.addEventListener('afterprint', () => {
    for (const d of opened) d.open = false
    opened = []
  })
  root.removeAttribute('data-nojs')
  paint()
}
