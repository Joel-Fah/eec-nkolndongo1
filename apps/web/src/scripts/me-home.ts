/** « Accueil »: my week. The next registration, this Sunday, my groups' next events, the profile if it is incomplete, and the soon-to-come card. */
import { api, button, type Ctx, dayText, done, el, fill, link } from './me-api'

type Reg = {
  status: string
  title: string
  eventDate: string
  eventSlug: string | null
  upcoming: boolean
}
type Group = {
  nameFr: string
  nameEn: string | null
  next: { titleFr: string; titleEn: string; startsAt: string } | null
}
type Sunday = { date: string; name: string; theme: string; published: boolean }
type Profile = { completeness: { filled: number; total: number; complete: boolean } }

export async function initHome(ctx: Ctx, box: HTMLElement, go: (id: string) => void) {
  const { msgs: m, links, lang } = ctx
  const [regs, groups, sunday, profile] = await Promise.all([
    api<{ items: Reg[] }>(`/registrations/mine?locale=${lang}`),
    api<{ items: Group[] }>('/me/groups'),
    api<Sunday>(`/liturgy/public/sunday?locale=${lang}`),
    api<Profile>('/me/profile'),
  ])
  box.replaceChildren()
  done(box)
  const card = (tone = '') => {
    const c = el('div', 'me-card')
    if (tone) c.dataset.tone = tone
    return c
  }

  const next = (regs.json.items ?? [])
    .filter((x) => x.upcoming && x.status !== 'cancelled')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]
  if (next) {
    const c = card('gold')
    c.append(el('span', 'me-k', m.next_reg_k), el('span', 'me-t', next.title))
    const row = el('div', 'me-row')
    row.append(el('span', 'me-m', dayText(next.eventDate, lang)))
    const pill = el('span', 'me-pill', m[`status_${next.status}`] ?? next.status)
    if (next.status === 'waitlist') pill.dataset.tone = 'warn'
    row.append(pill)
    const acts = el('div', 'me-actions')
    if (next.eventSlug)
      acts.append(
        link(
          m.calendar ?? '',
          `/api/events/public/item/${next.eventSlug}/event.ics?locale=${lang}`,
        ),
      )
    acts.append(button(m.nav_regs ?? '', 'btn btn-ghost btn-sm', () => go('inscriptions')))
    c.append(row, acts)
    box.append(c)
  }

  const s = sunday.json
  if (sunday.ok && s.date) {
    const c = card('green')
    c.append(el('span', 'me-k', m.sunday_k), el('span', 'me-t', s.name))
    c.append(el('span', 'me-m', [dayText(s.date, lang), s.theme].filter(Boolean).join(' · ')))
    c.append(link(m.sunday_open ?? '', links.sunday, 'btn btn-secondary btn-sm'))
    box.append(c)
  }

  const gs = (groups.json.items ?? []).filter((g) => g.next)
  if (gs.length) {
    const c = card()
    c.append(el('span', 'me-k', m.groups_k))
    for (const g of gs.slice(0, 3))
      c.append(
        el(
          'span',
          'me-m',
          `${(lang === 'en' && g.nameEn) || g.nameFr} · ${(lang === 'en' && g.next?.titleEn) || g.next?.titleFr} · ${dayText(g.next?.startsAt ?? '', lang)}`,
        ),
      )
    c.append(button(m.nav_groups ?? '', 'btn btn-ghost btn-sm', () => go('groupes')))
    box.append(c)
  }

  const comp = profile.json.completeness
  if (comp && !comp.complete) {
    const c = card()
    c.append(
      el('span', 'me-k', m.profile_k),
      el('span', 'me-m', fill(m.profile_todo ?? '', { n: comp.filled, total: comp.total })),
    )
    c.append(button(m.profile_go ?? '', 'btn btn-primary btn-sm', () => go('profil')))
    box.append(c)
  }

  const soon = card()
  soon.setAttribute('data-soon', '')
  soon.append(el('span', 'me-k', m.soon_k), el('span', 'me-t', m.soon_t))
  box.append(soon)
}
