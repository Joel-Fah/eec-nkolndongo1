/**
 * The public site's date and time pickers: the same look as the admin's (packages/ui/react/pickers.tsx), on native
 * [popover], ~3 KB, loaded only on pages that have a field marked `data-picker`. The native input stays in the page
 * (hidden once this runs), so the form keeps working with or without JavaScript. Labels come from the page as JSON.
 */
import { iconSvg } from './icons.ts'
import { placePopover } from './primitives.ts'

type Labels = {
  open: string
  prev: string
  next: string
  today: string
  clear: string
  chooseMonth: string
  chooseYear: string
  prevYears: string
  nextYears: string
  hour: string
  minute: string
  done: string
  placeholder: string
}

const DAY = 86_400_000
const parse = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(t).toISOString().slice(0, 10) === iso ? t : null
}
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => fmt((parse(iso) ?? 0) + n * DAY)
const addMonths = (iso: string, n: number) => {
  const d = new Date(parse(iso) ?? 0)
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate()
  return fmt(first + (Math.min(d.getUTCDate(), last) - 1) * DAY)
}
const clamp = (iso: string, min?: string, max?: string) =>
  min && iso < min ? min : max && iso > max ? max : iso
const weekdayOf = (iso: string) => (new Date(parse(iso) ?? 0).getUTCDay() + 6) % 7
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

function enhance(input: HTMLInputElement) {
  if (input.dataset.pickerReady) return
  input.dataset.pickerReady = '1'
  const labels = JSON.parse(input.dataset.picker ?? '{}') as Labels
  const isTime = input.type === 'time'
  const locale = document.documentElement.lang || 'fr'
  const wrap = document.createElement('span')
  wrap.className = 'input-wrap'
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'input picker-trigger'
  trigger.setAttribute('data-icon', '')
  const icon = document.createElement('span')
  icon.className = 'input-icon'
  icon.innerHTML = iconSvg(isTime ? 'time' : 'calendarMinus', { size: 20 })
  icon.setAttribute('aria-hidden', 'true')
  wrap.append(trigger, icon)
  input.after(wrap)
  input.hidden = true
  const pop = document.createElement('div')
  pop.className = `eec-popover picker-pop${isTime ? ' picker-time' : ''}`
  pop.setAttribute('popover', 'auto')
  document.body.append(pop)

  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const dayLong = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const monthLong = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const weekShort = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const labelText = () => input.closest('label')?.querySelector('span')?.textContent?.trim() ?? ''

  const paint = () => {
    const v = input.value
    const ok = isTime ? /^\d\d:\d\d$/.test(v) : parse(v) !== null
    trigger.textContent = ok ? (isTime ? v : day.format(parse(v) as number)) : labels.placeholder
    trigger.toggleAttribute('data-empty', !ok)
    trigger.setAttribute('aria-label', `${labelText()}: ${ok ? trigger.textContent : labels.open}`)
  }
  const set = (v: string) => {
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    paint()
    pop.hidePopover()
  }
  paint()

  let cursor = ''
  let view: 'days' | 'months' | 'years' = 'days'
  const min = input.min || undefined
  const max = input.max || undefined
  const today = fmt(Date.now())
  const out = (d: string) => (min && d < min) || (max && d > max)
  const btn = (cls: string, attrs: string, html: string) =>
    `<button type="button" class="${cls}" ${attrs}>${html}</button>`

  const renderDate = () => {
    const cy = Number(cursor.slice(0, 4))
    const cm = Number(cursor.slice(5, 7)) - 1
    const first = `${String(cy).padStart(4, '0')}-${String(cm + 1).padStart(2, '0')}-01`
    const lead = weekdayOf(first)
    const yearsFrom = Math.floor(cy / 12) * 12
    const title =
      view === 'years'
        ? `${yearsFrom} – ${yearsFrom + 11}`
        : view === 'months'
          ? String(cy)
          : `${monthLong.format(Date.UTC(cy, cm, 1))} ${cy}`
    let body = ''
    if (view === 'days') {
      const week = Array.from(
        { length: 7 },
        (_, i) =>
          `<span aria-hidden="true">${esc(weekShort.format(Date.UTC(2024, 0, 1 + i)).replace('.', ''))}</span>`,
      ).join('')
      const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead))
        .map((d) => {
          const inMonth = Number(d.slice(5, 7)) - 1 === cm
          return btn(
            'picker-day',
            `data-d="${d}" tabindex="${d === cursor ? 0 : -1}" aria-pressed="${d === input.value}" aria-label="${esc(dayLong.format(parse(d) as number))}"${inMonth ? '' : ' data-out-month'}${d === today ? ' data-today aria-current="date"' : ''}${out(d) ? ' disabled' : ''}`,
            String(Number(d.slice(8, 10))),
          )
        })
        .join('')
      body = `<div><div class="picker-week">${week}</div><div class="picker-days">${days}</div></div>`
    } else if (view === 'months') {
      body = `<div class="picker-cells">${Array.from({ length: 12 }, (_, i) =>
        btn(
          'picker-cell',
          `data-m="${i}" aria-pressed="${i === cm}"`,
          esc(monthShort.format(Date.UTC(2024, i, 1)).replace('.', '')),
        ),
      ).join('')}</div>`
    } else {
      body = `<div class="picker-cells">${Array.from({ length: 12 }, (_, i) => yearsFrom + i)
        .map((y) =>
          btn(
            'picker-cell',
            `data-y="${y}" aria-pressed="${y === cy}"${(min && y < Number(min.slice(0, 4))) || (max && y > Number(max.slice(0, 4))) ? ' disabled' : ''}`,
            String(y),
          ),
        )
        .join('')}</div>`
    }
    pop.innerHTML = `<div class="picker-head">${btn('picker-nav', `data-nav="-1" aria-label="${esc(view === 'years' ? labels.prevYears : labels.prev)}"`, iconSvg('chevronLeft', { size: 20 }))}${btn('picker-title', `data-title aria-label="${esc(view === 'days' ? labels.chooseMonth : labels.chooseYear)}"`, esc(title))}${btn('picker-nav', `data-nav="1" aria-label="${esc(view === 'years' ? labels.nextYears : labels.next)}"`, iconSvg('chevronRight', { size: 20 }))}</div>${body}<div class="picker-foot">${btn('picker-link', `data-today-go${out(today) ? ' disabled' : ''}`, esc(labels.today))}${input.value && !input.required ? btn('picker-link', 'data-clear', esc(labels.clear)) : ''}</div>`
  }
  const renderTime = () => {
    const [hh = '', mm = ''] = input.value.split(':')
    const step = Number(input.step) > 0 ? Math.max(1, Math.round(Number(input.step) / 60)) : 5
    const col = (name: string, list: string[], cur: string, k: string) =>
      `<fieldset class="picker-col"><legend class="sr-only">${esc(name)}</legend>${list.map((x) => btn('picker-cell', `data-${k}="${x}" aria-pressed="${x === cur}"`, x)).join('')}</fieldset>`
    pop.innerHTML = `<div class="picker-cols">${col(
      labels.hour,
      Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
      hh,
      'h',
    )}${col(
      labels.minute,
      Array.from({ length: Math.ceil(60 / step) }, (_, i) => String(i * step).padStart(2, '0')),
      mm,
      'min',
    )}</div><div class="picker-foot">${btn('picker-link', 'data-done', esc(labels.done))}${input.value && !input.required ? btn('picker-link', 'data-clear', esc(labels.clear)) : ''}</div>`
    for (const el of pop.querySelectorAll('[aria-pressed="true"]'))
      (el as HTMLElement).scrollIntoView({ block: 'center' })
  }
  const render = () => {
    if (isTime) renderTime()
    else renderDate()
    if (!isTime && view === 'days') pop.querySelector<HTMLElement>(`[data-d="${cursor}"]`)?.focus()
  }

  trigger.addEventListener('click', () => {
    cursor = parse(input.value) ? clamp(input.value, min, max) : clamp(today, min, max)
    view = 'days'
    render()
    pop.showPopover()
    placePopover(pop, trigger)
    if (!isTime) pop.querySelector<HTMLElement>(`[data-d="${cursor}"]`)?.focus()
  })
  pop.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (!el) return
    const d = el.dataset
    if (d.d) return set(d.d)
    if (d.clear !== undefined) return set('')
    if (d.todayGo !== undefined) return set(today)
    if (d.done !== undefined) return pop.hidePopover()
    if (d.h !== undefined) {
      const [, mm = '00'] = input.value.split(':')
      input.value = `${d.h}:${mm}`
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      paint()
      return renderTime()
    }
    if (d.min !== undefined) return set(`${input.value.split(':')[0] || '08'}:${d.min}`)
    if (d.nav) {
      cursor = addMonths(
        cursor,
        Number(d.nav) * (view === 'years' ? 144 : view === 'months' ? 12 : 1),
      )
      return render()
    }
    if (d.title !== undefined) {
      view = view === 'days' ? 'months' : view === 'months' ? 'years' : 'days'
      return render()
    }
    if (d.m !== undefined) {
      cursor = clamp(addMonths(cursor, Number(d.m) - (Number(cursor.slice(5, 7)) - 1)), min, max)
      view = 'days'
      return render()
    }
    if (d.y !== undefined) {
      cursor = clamp(addMonths(cursor, (Number(d.y) - Number(cursor.slice(0, 4))) * 12), min, max)
      view = 'months'
      render()
    }
  })
  pop.addEventListener('keydown', (e) => {
    if (isTime || view !== 'days') return
    const w = weekdayOf(cursor)
    const step: Record<string, string> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      Home: addDays(cursor, -w),
      End: addDays(cursor, 6 - w),
      PageUp: addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: addMonths(cursor, e.shiftKey ? 12 : 1),
    }
    const next = step[e.key]
    if (!next) return
    e.preventDefault()
    cursor = clamp(next, min, max)
    render()
  })
}

/** Enhance every field marked `data-picker` (date or time). Safe to call again after a page swap. */
let watching = false
export function initPickers(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLInputElement>('input[data-picker]')) enhance(el)
  // A page that swaps part of itself in place (the agenda's filters) brings new fields: enhance those too.
  if (watching) return
  watching = true
  new MutationObserver(() => {
    for (const el of document.querySelectorAll<HTMLInputElement>(
      'input[data-picker]:not([data-picker-ready])',
    ))
      enhance(el)
  }).observe(document.body, { childList: true, subtree: true })
}
