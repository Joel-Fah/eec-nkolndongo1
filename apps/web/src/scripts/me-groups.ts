/** « Mes groupes »: the groups this member belongs to, each with its next event; leaving is immediate. */
import { api, button, type Ctx, dayText, done, el, empty, link } from './me-api'

type Group = {
  id: string
  key: string
  nameFr: string
  nameEn: string | null
  titleFr: string
  titleEn: string
  next: { slug: string; titleFr: string; titleEn: string; startsAt: string } | null
}

export async function initGroups(ctx: Ctx, box: HTMLElement, onChange: () => void) {
  const { msgs: m, links, lang } = ctx
  const r = await api<{ items: Group[] }>('/me/groups')
  box.replaceChildren()
  done(box)
  if (!r.ok) return void box.append(empty(m.err ?? '', ''))
  const en = lang === 'en'
  if (!r.json.items.length)
    box.append(
      empty(
        m.groups_empty_t ?? '',
        m.groups_empty_p ?? '',
        link(m.groups_discover ?? '', links.departments, 'btn btn-primary btn-sm'),
      ),
    )
  for (const g of r.json.items) {
    const c = el('div', 'me-card')
    const top = el('div', 'me-row')
    top.append(el('span', 'me-t', (en && g.nameEn) || g.nameFr))
    const role = (en && g.titleEn) || g.titleFr
    top.append(el('span', 'me-pill', role || (m.member_badge ?? '')))
    c.append(top)
    c.append(
      el(
        'span',
        'me-m',
        g.next
          ? `${m.next_event}: ${(en && g.next.titleEn) || g.next.titleFr} · ${dayText(g.next.startsAt, lang, true)}`
          : (m.no_event ?? ''),
      ),
    )
    const acts = el('div', 'me-actions')
    acts.append(link(m.view_page ?? '', links.deptBase.replace('__KEY__', g.key)))
    acts.append(
      button(m.leave ?? '', 'btn btn-ghost btn-sm', (b) => {
        if (b.dataset.ask !== '1') {
          b.dataset.ask = '1'
          b.textContent = m.leave_ask ?? ''
          return
        }
        void api(`/me/groups/${g.id}`, { method: 'DELETE' }).then(() => {
          void initGroups(ctx, box, onChange)
          onChange()
        })
      }),
    )
    c.append(acts)
    box.append(c)
  }
}
