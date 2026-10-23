/**
 * « Ajouter à mon calendrier »: builds an iCalendar file of the meditation programme IN THE BROWSER, at the hour the visitor
 * picks (a floating local time, so it is that hour wherever the phone is), one 15-minute reminder a day with the passages
 * to read. The programme is the cached public JSON; nothing is sent anywhere and nothing is stored.
 */
type Plan = {
  plan: { title: string } | null
  days: { date: string; headline: string; passages: string[] }[]
}

const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, ';').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const enc = new TextEncoder()
function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export function buildMeditationIcs(
  data: Plan,
  time: string,
  fromToday: boolean,
  locale: string,
): string {
  const [hh = '06', mm = '00'] = time.split(':')
  const start = `${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`
  const endMin = Number(hh) * 60 + Number(mm) + 15
  const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EEC Nkolndongo 1//Meditations//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(data.plan?.title ?? 'Méditations')}`,
  ]
  for (const d of data.days) {
    if (fromToday && d.date < today) continue
    const day = d.date.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:med-${d.date}@eec-nkolndongo1`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${day}T${start}`,
      `DTEND:${day}T${end}`,
      `SUMMARY:${esc(`${locale === 'en' ? 'Meditation' : 'Méditation'}${d.headline ? ` · ${d.headline}` : ''}`)}`,
      `DESCRIPTION:${esc(d.passages.join('\n'))}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}

export function initMeditationCalendar() {
  const box = document.querySelector<HTMLElement>('[data-med-calendar]')
  if (!box || box.dataset.bound) return
  box.dataset.bound = '1'
  const button = box.querySelector<HTMLButtonElement>('button[data-go]')
  const time = box.querySelector<HTMLInputElement>('input[type="time"]')
  const from = box.querySelector<HTMLInputElement>('input[data-from-today]')
  const status = box.querySelector<HTMLElement>('[data-status]')
  const { locale = 'fr', busy = '', error = '', label = '' } = box.dataset
  button?.addEventListener('click', async () => {
    if (!button) return
    button.disabled = true
    const original = button.textContent
    button.textContent = busy
    if (status) status.textContent = ''
    try {
      const res = await fetch(`/api/meditations/public/plan?locale=${locale}`, {
        credentials: 'omit',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as Plan
      const ics = buildMeditationIcs(data, time?.value || '06:00', !!from?.checked, locale)
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${label || 'meditations'}.ics`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      if (status) status.textContent = error
    } finally {
      button.disabled = false
      button.textContent = original
    }
  })
}
