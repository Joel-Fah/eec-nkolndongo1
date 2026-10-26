/** « Mes inscriptions »: upcoming and past registrations of this member, cancel, add to the calendar, and link one made without an account. */
import { api, button, type Ctx, dayText, done, el, empty, fill, link } from './me-api'

type Reg = {
  id: string
  code: string
  status: 'confirmed' | 'waitlist' | 'cancelled'
  partySize: number
  position: number | null
  title: string
  eventDate: string
  eventSlug: string | null
  upcoming: boolean
  purgeOn: string
}

export async function initRegs(ctx: Ctx, box: HTMLElement, onChange: () => void) {
  const { msgs: m, links, lang } = ctx
  const r = await api<{ items: Reg[] }>(`/registrations/mine?locale=${lang}`)
  box.replaceChildren()
  done(box)
  if (!r.ok) return void box.append(empty(m.err ?? '', ''))
  const items = r.json.items
  const card = (x: Reg) => {
    const c = el('div', 'me-card')
    c.dataset.tone = x.upcoming && x.status === 'confirmed' ? 'gold' : ''
    const top = el('div', 'me-row')
    top.append(el('span', 'me-t', x.title))
    const pill = el('span', 'me-pill', m[`status_${x.status}`] ?? x.status)
    if (x.status === 'waitlist') pill.dataset.tone = 'warn'
    if (x.status === 'cancelled') pill.dataset.tone = 'off'
    top.append(pill)
    const meta = [
      dayText(x.eventDate, lang),
      fill(m.people ?? '', { n: x.partySize }),
      `#${x.code}`,
    ]
    if (x.position) meta.splice(1, 0, fill(m.position ?? '', { n: x.position }))
    c.append(top, el('span', 'me-m', meta.join(' · ')))
    if (!x.upcoming)
      c.append(el('span', 'me-m', fill(m.kept_until ?? '', { date: dayText(x.purgeOn, lang) })))
    if (x.upcoming && x.status !== 'cancelled') {
      const acts = el('div', 'me-actions')
      if (x.eventSlug)
        acts.append(
          link(m.calendar ?? '', `/api/events/public/item/${x.eventSlug}/event.ics?locale=${lang}`),
        )
      acts.append(
        button(m.cancel ?? '', 'btn btn-ghost btn-sm', (b) => {
          // Two steps: the first tap asks, the second does it.
          if (b.dataset.ask !== '1') {
            b.dataset.ask = '1'
            b.textContent = m.cancel_ask ?? ''
            return
          }
          void api(`/registrations/mine/${x.id}/cancel`, { method: 'POST', body: {} }).then(() => {
            void initRegs(ctx, box, onChange)
            onChange()
          })
        }),
      )
      c.append(acts)
    }
    return c
  }
  const up = items.filter((x) => x.upcoming).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  const past = items.filter((x) => !x.upcoming)
  if (!items.length)
    box.append(
      empty(
        m.regs_empty_t ?? '',
        m.regs_empty_p ?? '',
        link(m.regs_agenda ?? '', links.agenda, 'btn btn-primary btn-sm'),
      ),
    )
  if (up.length) box.append(el('p', 'me-wk', m.regs_upcoming), ...up.map(card))
  if (past.length) box.append(el('p', 'me-wk', m.regs_past), ...past.map(card))

  // « Relier »: the signed cancel link proves a registration made without an account is theirs.
  const form = el('form', 'me-card me-link')
  form.dataset.tone = 'gold'
  const input = el('input', 'input', undefined, {
    type: 'text',
    placeholder: m.link_ph ?? '',
    'aria-label': m.link_t ?? '',
  })
  const out = el('p', 'me-m', '', { role: 'status' })
  form.append(
    el('strong', '', m.link_t),
    el('span', 'me-m', m.link_p),
    input,
    button(m.link_go ?? '', 'btn btn-secondary btn-sm'),
    out,
  )
  form.querySelector('button')?.setAttribute('type', 'submit')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const res = await api('/registrations/mine/claim', { body: { token: input.value.trim() } })
    out.textContent = res.ok
      ? (m.link_done ?? '')
      : res.status === 409
        ? (m.link_taken ?? '')
        : res.status === 429
          ? (m.link_rate ?? '')
          : (m.link_bad ?? '')
    if (res.ok) {
      input.value = ''
      void initRegs(ctx, box, onChange)
      onChange()
    }
  })
  box.append(form)
}
