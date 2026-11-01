/** « Notifications »: this member's list in the site, grouped by week, with a deep link, « mark all read » and a mute per kind (decision 0046). */
import { api, button, type Ctx, dayText, done, el, empty, fill } from './me-api'

type N = {
  id: string
  kind: string
  params: { title?: string; titleEn?: string; mustAccept?: boolean }
  href: string
  weekOf: string
  read: boolean
  resolved: boolean
}
const KINDS = [
  'waitlist_promoted',
  'policy_change',
  'group_announcement',
  'group_decision',
  'communion_reminder',
]
const DAY = 86_400_000
const monday = (d: Date) =>
  new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10)

export async function initNotifs(ctx: Ctx, box: HTMLElement, onCount: (n: number) => void) {
  const { msgs: m, lang } = ctx
  const r = await api<{ items: N[]; unread: number; muted: string[] }>('/me/notifications')
  box.replaceChildren()
  done(box)
  if (!r.ok) return void box.append(empty(m.err ?? '', ''))
  onCount(r.json.unread)
  const reload = () => initNotifs(ctx, box, onCount)
  const head = el('div', 'me-row')
  head.append(
    r.json.unread
      ? button(
          m.mark_all ?? '',
          'btn btn-ghost btn-sm',
          () => void api('/me/notifications/read', { body: { all: true } }).then(reload),
        )
      : el('span'),
    button(m.settings ?? '', 'btn btn-ghost btn-sm', () => settings.toggleAttribute('hidden')),
  )
  const settings = el('div', 'me-card')
  settings.hidden = true
  settings.append(el('span', 'me-m', m.settings_p))
  for (const k of KINDS) {
    const row = el('label', 'check-row')
    const box2 = el('input', 'checkbox', undefined, { type: 'checkbox' })
    box2.checked = !r.json.muted.includes(k)
    box2.addEventListener(
      'change',
      () =>
        void api('/me/notifications/mute', {
          method: 'PUT',
          body: { kind: k, muted: !box2.checked },
        }).then(reload),
    )
    row.append(box2, el('span', '', m[`kind_${k}`] ?? k))
    settings.append(row)
  }
  box.append(head, settings)
  if (!r.json.items.length)
    return void box.append(empty(m.notifs_empty_t ?? '', m.notifs_empty_p ?? ''))

  const thisWeek = monday(new Date())
  const lastWeek = new Date(Date.parse(`${thisWeek}T12:00:00Z`) - 7 * DAY)
    .toISOString()
    .slice(0, 10)
  const weeks = new Map<string, N[]>()
  for (const n of r.json.items) weeks.set(n.weekOf, [...(weeks.get(n.weekOf) ?? []), n])
  for (const [w, list] of weeks) {
    box.append(
      el(
        'p',
        'me-wk',
        w === thisWeek
          ? m.this_week
          : w === lastWeek
            ? m.last_week
            : fill(m.week_of ?? '', { date: dayText(w, lang) }),
      ),
    )
    for (const n of list) {
      const title = (lang === 'en' && n.params.titleEn) || n.params.title || ''
      const c = el('div', 'me-card me-notif')
      const target = n.href.startsWith('account:') ? `#${n.href.slice(8)}` : n.href
      const a = el('a', '', undefined, { href: target })
      const t = el('strong', '', m[`${n.kind}_t`] ?? n.kind)
      if (!n.read && !n.resolved)
        t.prepend(el('span', 'me-unread', undefined, { 'aria-hidden': 'true' }))
      a.append(t, el('span', 'me-m', fill(m[`${n.kind}_p`] ?? '', { title })))
      a.addEventListener('click', () => {
        if (!n.read) void api('/me/notifications/read', { body: { ids: [n.id] } })
      })
      c.append(
        a,
        button(
          '×',
          'btn btn-ghost btn-sm',
          () => void api('/me/notifications/dismiss', { body: { ids: [n.id] } }).then(reload),
        ),
      )
      c.lastElementChild?.setAttribute('aria-label', m.dismiss ?? '')
      box.append(c)
    }
  }
}
