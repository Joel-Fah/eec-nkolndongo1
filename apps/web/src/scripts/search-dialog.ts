/**
 * The header search dialog: as you type (debounced) the top results come from the edge-cached /api/search; Enter goes
 * to the full results page (the form's normal GET, so it works even if this script does not). Text is set with
 * textContent only. Nothing is stored; the dialog is just a faster way into the same page.
 */
type Item = { type: string; key: string; title: string; snippet: string }
type Sug = {
  guides: { key: string; title: string }[]
  departments: { key: string; title: string }[]
  news: { key: string; title: string }[]
  event: { key: string; title: string } | null
}

export function initSearchDialog() {
  const dlg = document.querySelector<HTMLDialogElement>('[data-search]')
  if (!dlg || dlg.dataset.ready) return
  dlg.dataset.ready = '1'
  const input = dlg.querySelector<HTMLInputElement>('input[name="q"]')
  const out = dlg.querySelector<HTMLElement>('[data-search-results]')
  if (!input || !out) return
  const hints = dlg.querySelector<HTMLElement>('[data-search-hints]')
  const sugBox = dlg.querySelector<HTMLElement>('[data-search-sug]')
  const d = dlg.dataset
  const locale = d.locale ?? 'fr'
  let timer: number | undefined
  let seq = 0

  const link = (it: Item) => {
    const base = d[it.type] ?? ''
    return `${base}${it.key}/`
  }
  const render = (items: Item[], q: string, didYouMean: string[] = []) => {
    out.replaceChildren()
    if (hints) hints.hidden = items.length > 0
    if (!items.length) {
      const p = document.createElement('p')
      p.className = 'sd-snip'
      p.textContent = (d.empty ?? '').replace('{q}', q)
      out.append(p)
      if (didYouMean.length) {
        const row = document.createElement('p')
        row.className = 'sd-try'
        const lead = document.createElement('span')
        lead.textContent = d.did ?? ''
        row.append(lead)
        for (const x of didYouMean) {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'sd-chip'
          b.textContent = x
          b.addEventListener('click', () => fill(x))
          row.append(b)
        }
        out.append(row)
      }
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
    // A few direct actions after the results.
    const acts = hints?.querySelectorAll<HTMLAnchorElement>('[data-search-actions] a')
    if (acts?.length) {
      const h = document.createElement('span')
      h.className = 'sd-h'
      h.textContent = d.related ?? ''
      out.append(h)
      for (const a of [...acts].slice(0, 3)) {
        const c = a.cloneNode(true) as HTMLAnchorElement
        c.classList.add('sd-act')
        out.append(c)
      }
    }
  }
  const run = async () => {
    const q = input.value.replace(/\s+/g, ' ').trim()
    if (q.length < 2) {
      out.replaceChildren()
      if (hints) hints.hidden = false
      return
    }
    const mine = ++seq
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, {
        credentials: 'omit',
      })
      if (mine !== seq) return
      if (!r.ok) throw new Error(String(r.status))
      const data = (await r.json()) as { items: Item[]; didYouMean?: string[] }
      render(data.items, q, data.didYouMean)
    } catch {
      if (mine !== seq) return
      out.replaceChildren()
      const p = document.createElement('p')
      p.className = 'sd-snip'
      p.textContent = d.unavailable ?? ''
      out.append(p)
    }
  }
  const fill = (text: string) => {
    input.value = text
    input.focus()
    void run()
  }
  for (const b of dlg.querySelectorAll<HTMLButtonElement>('[data-example]'))
    b.addEventListener('click', () => fill(b.dataset.example ?? ''))
  // Real things to try (guides, groups, news, the next event), loaded once the first time the dialog opens.
  let loaded = false
  const loadSuggestions = async () => {
    if (loaded || !sugBox) return
    loaded = true
    try {
      const r = await fetch(`/api/search/suggest?locale=${locale}`, { credentials: 'omit' })
      if (!r.ok) return
      const s = (await r.json()) as Sug
      const groups: [string, { key: string; title: string }[], string][] = [
        ['sug_event', s.event ? [s.event] : [], 'events'],
        ['sug_guides', s.guides, 'guides'],
        ['sug_groups', s.departments, 'departments'],
        ['sug_news', s.news, 'news'],
      ]
      for (const [label, rows, type] of groups) {
        if (!rows.length) continue
        const h = document.createElement('h2')
        h.className = 'sd-h'
        h.textContent = d[label] ?? ''
        const box = document.createElement('div')
        box.className = 'sd-sug'
        for (const x of rows) {
          const a = document.createElement('a')
          a.href = `${d[type] ?? ''}${x.key}/`
          a.textContent = x.title
          box.append(a)
        }
        sugBox.append(h, box)
      }
    } catch {
      // Suggestions are a bonus.
    }
  }
  input.addEventListener('input', () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 220)
  })
  // Opening focuses the field; closing clears it for next time.
  new MutationObserver(() => {
    if (dlg.open) {
      input.focus()
      void loadSuggestions()
    } else {
      input.value = ''
      out.replaceChildren()
    }
  }).observe(dlg, { attributes: true, attributeFilter: ['open'] })
}
