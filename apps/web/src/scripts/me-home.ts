/** « Accueil »: my week. The next registration, this Sunday, my groups' next events, the profile if it is incomplete, and the soon-to-come card. */
import {
  api,
  button,
  type Ctx,
  dayText,
  done,
  el,
  fill,
  ico,
  link,
  profile as readProfile,
} from './me-api'

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

export async function initHome(ctx: Ctx, box: HTMLElement, go: (id: string) => void) {
  const { msgs: m, links, lang } = ctx
  const [regs, groups, sunday, profile] = await Promise.all([
    api<{ items: Reg[] }>(`/registrations/mine?locale=${lang}`),
    api<{ items: Group[] }>('/me/groups'),
    api<Sunday>(`/liturgy/public/sunday?locale=${lang}`),
    readProfile(),
  ])
  box.replaceChildren()
  done(box)
  const card = (tone = '') => {
    const c = el('div', 'me-card')
    if (tone) c.dataset.tone = tone
    return c
  }
  /** The top of a card: an icon, then the small label and the title. */
  const head = (icon: string, k: string, t?: string) => {
    const top = el('div', 'me-top')
    const words = el('div', 'grid')
    words.append(el('span', 'me-k', k))
    if (t) words.append(el('span', 'me-t', t))
    top.append(ico(icon), words)
    return top
  }

  const next = (regs.json.items ?? [])
    .filter((x) => x.upcoming && x.status !== 'cancelled')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0]
  if (next) {
    const c = card('gold')
    c.append(head('calendar', m.next_reg_k ?? '', next.title))
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
    c.append(row, el('p', 'me-p', m.next_reg_p), acts)
    box.append(c)
  } else if (regs.ok) {
    const c = card()
    c.append(head('calendar', m.next_reg_k ?? '', m.none_reg_t), el('p', 'me-p', m.none_reg_p))
    c.append(link(m.regs_agenda ?? '', links.agenda, 'btn btn-secondary btn-sm'))
    box.append(c)
  }

  const s = sunday.json
  if (sunday.ok && s.date) {
    const c = card('green')
    c.append(head('church', m.sunday_k ?? '', s.name))
    c.append(el('span', 'me-m', [dayText(s.date, lang), s.theme].filter(Boolean).join(' · ')))
    c.append(el('p', 'me-p', m.sunday_p))
    c.append(link(m.sunday_open ?? '', links.sunday, 'btn btn-secondary btn-sm'))
    box.append(c)
  }

  const gs = (groups.json.items ?? []).filter((g) => g.next)
  if (gs.length) {
    const c = card()
    c.append(head('users', m.groups_k ?? ''), el('p', 'me-p', m.groups_p))
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
  } else if (groups.ok) {
    const c = card()
    c.append(head('users', m.groups_k ?? '', m.groups_empty_t), el('p', 'me-p', m.groups_none_p))
    c.append(link(m.groups_discover ?? '', links.departments, 'btn btn-secondary btn-sm'))
    box.append(c)
  }

  const comp = profile.json.completeness
  if (comp) {
    const c = card()
    if (comp.complete) {
      c.append(head('check', m.profile_k ?? '', m.profile_ok_t), el('p', 'me-p', m.profile_ok_p))
      c.append(button(m.nav_profile ?? '', 'btn btn-ghost btn-sm', () => go('profil')))
    } else {
      c.append(
        head(
          'userRoundPlus',
          m.profile_k ?? '',
          fill(m.profile_todo ?? '', { n: comp.filled, total: comp.total }),
        ),
        el('p', 'me-p', m.profile_p),
      )
      c.append(button(m.profile_go ?? '', 'btn btn-primary btn-sm', () => go('profil')))
    }
    box.append(c)
  }

  box.append(communionCard(m, lang))
}

/** The Communion card, as it will look: a preview with the year's twelve months empty. Nothing here is a fact about the member. */
function communionCard(m: Record<string, string>, lang: string) {
  const c = el('div', 'me-card me-comm')
  c.setAttribute('data-soon', '')
  const top = el('div', 'me-row')
  top.append(el('span', 'me-k', m.card_k), el('span', 'me-pill', m.card_soon))
  const face = el('div', 'me-comm-face')
  face.append(ico('church', 'me-comm-ico'), el('span', 'me-comm-parish', m.card_parish))
  const grid = el('ol', 'me-comm-grid')
  grid.setAttribute('aria-hidden', 'true')
  const fmt = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' })
  for (let i = 0; i < 12; i++) grid.append(el('li', '', fmt.format(new Date(Date.UTC(2026, i, 1)))))
  face.append(grid, el('span', 'me-comm-tag', m.card_preview))
  c.append(top, face, el('span', 'me-t', m.card_t), el('p', 'me-p', m.card_p))
  return c
}
