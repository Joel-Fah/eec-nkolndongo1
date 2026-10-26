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
    acts.append(button(m.nav_regs ?? '', 'btn btn-secondary btn-sm', () => go('inscriptions')))
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
    c.append(button(m.nav_groups ?? '', 'btn btn-secondary btn-sm', () => go('groupes')))
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
      c.append(button(m.nav_profile ?? '', 'btn btn-secondary btn-sm', () => go('profil')))
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

  // The Communion card: only for a person who holds one; nobody else is shown anything about it.
  const kept = await (await import('./me-card')).loadCard()
  if (kept) {
    const { cardEl } = await import('./me-card')
    box.append(
      cardEl(kept.card, {
        msgs: m,
        lang,
        offline: kept.offline,
        onChange: () => void initHome(ctx, box, go),
      }),
    )
  }
  pack(box)
}

/**
 * The bento on desktop: three columns, the Communion card tall on the right (rows 1 and 2), the other cards to its left. The first one is
 * wide; each row's last card stretches so no cell stays empty, whatever cards the member has.
 */
function pack(box: HTMLElement) {
  const others = [...box.children].filter((c) => !c.classList.contains('me-comm')) as HTMLElement[]
  let row = 1
  let used = 0
  // With a Communion card, rows 1 and 2 have two columns beside it; without one, all three.
  const hasCard = box.querySelector('.me-comm') !== null
  const cap = () => (hasCard && row <= 2 ? 2 : 3)
  others.forEach((c, i) => {
    const w = i === 0 ? Math.min(2, cap()) : 1
    c.dataset.span = String(w)
    used += w
    const last = i === others.length - 1
    if (used >= cap() || last) {
      // the row ends here: stretch this card to fill it
      c.dataset.span = String(Number(c.dataset.span) + cap() - used)
      row++
      used = 0
    }
  })
}
