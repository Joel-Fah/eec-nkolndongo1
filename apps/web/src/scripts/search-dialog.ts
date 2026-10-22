/**
 * The header search dialog: as you type (debounced) the top results come from the edge-cached /api/search; Enter goes
 * to the full results page (the form's normal GET, so it works even if this script does not). Text is set with
 * textContent only. Nothing is stored; the dialog is just a faster way into the same page.
 */
type Item = { type: string; key: string; title: string; snippet: string }

export function initSearchDialog() {
  const dlg = document.querySelector<HTMLDialogElement>('[data-search]')
  if (!dlg || dlg.dataset.ready) return
  dlg.dataset.ready = '1'
  const input = dlg.querySelector<HTMLInputElement>('input[name="q"]')
  const out = dlg.querySelector<HTMLElement>('[data-search-results]')
  if (!input || !out) return
  const d = dlg.dataset
  const locale = d.locale ?? 'fr'
  let timer: number | undefined
  let seq = 0

  const link = (it: Item) => {
    const base = d[it.type] ?? ''
    return `${base}${it.key}/`
  }
  const render = (items: Item[], q: string) => {
    out.replaceChildren()
    if (!items.length) {
      const p = document.createElement('p')
      p.className = 'sd-snip'
      p.textContent = (d.empty ?? '').replace('{q}', q)
      out.append(p)
      return
    }
    for (const it of items.slice(0, 6)) {
      const a = document.createElement('a')
      a.href = link(it)
      const title = document.createElement('strong')
      title.textContent = it.title
      const kind = document.createElement('span')
      kind.className = 'sd-h'
      kind.textContent = d[`type_${it.type}`] ?? ''
      a.append(kind, title)
      if (it.snippet) {
        const s = document.createElement('span')
        s.className = 'sd-snip'
        s.textContent = it.snippet
        a.append(s)
      }
      out.append(a)
    }
    const all = document.createElement('a')
    all.className = 'sd-more'
    all.href = `${d.all}?q=${encodeURIComponent(q)}`
    all.textContent = d.more ?? ''
    out.append(all)
  }
  const run = async () => {
    const q = input.value.replace(/\s+/g, ' ').trim()
    if (q.length < 2) {
      out.replaceChildren()
      return
    }
    const mine = ++seq
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, {
        credentials: 'omit',
      })
      if (mine !== seq) return
      if (!r.ok) throw new Error(String(r.status))
      render(((await r.json()) as { items: Item[] }).items, q)
    } catch {
      if (mine !== seq) return
      out.replaceChildren()
      const p = document.createElement('p')
      p.className = 'sd-snip'
      p.textContent = d.unavailable ?? ''
      out.append(p)
    }
  }
  input.addEventListener('input', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 220)
  })
  // Opening focuses the field; closing clears it for next time.
  new MutationObserver(() => {
    if (dlg.open) input.focus()
    else {
      input.value = ''
      out.replaceChildren()
    }
  }).observe(dlg, { attributes: true, attributeFilter: ['open'] })
}
