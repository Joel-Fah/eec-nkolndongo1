/**
 * « Mes groupes » (decision 0049): the groups this member belongs to with their latest announcements and next event; requests waiting for an
 * answer; the groups they can ask to join (the request carries one unticked choice: share my number with the leaders); leaving is immediate.
 */
import { api, button, type Ctx, dayText, done, el, empty, ico, link } from './me-api'

type Announcement = {
  id: string
  titleFr: string
  titleEn: string
  bodyFr: string
  bodyEn: string
  link: string | null
  publishedAt: string
}
type Group = {
  id: string
  key: string
  nameFr: string
  nameEn: string | null
  titleFr: string
  titleEn: string
  sharePhone: boolean
  next: { slug: string; titleFr: string; titleEn: string; startsAt: string } | null
  announcements: Announcement[]
}
type Pending = { id: string; groupId: string; nameFr: string; nameEn: string | null }
type Open = {
  id: string
  nameFr: string
  nameEn: string | null
  descriptionFr: string | null
  descriptionEn: string | null
  request: { id: string; status: string; message: string | null } | null
}

export async function initGroups(ctx: Ctx, box: HTMLElement, onChange: () => void) {
  const { msgs: m, links, lang } = ctx
  const [r, dir] = await Promise.all([
    api<{ items: Group[]; pending: Pending[] }>('/me/groups'),
    api<{ items: Open[] }>('/me/groups/directory'),
  ])
  box.replaceChildren()
  done(box)
  if (!r.ok) return void box.append(empty(m.err ?? '', ''))
  const en = lang === 'en'
  const reload = () => {
    void initGroups(ctx, box, onChange)
    onChange()
  }
  const nameOf = (g: { nameFr: string; nameEn: string | null }) => (en && g.nameEn) || g.nameFr

  if (!r.json.items.length && !r.json.pending.length)
    box.append(empty(m.groups_empty_t ?? '', m.groups_empty_p ?? ''))

  for (const g of r.json.items) {
    const c = el('div', 'me-card')
    const top = el('div', 'me-top')
    const words = el('div', 'grid')
    words.append(el('span', 'me-t', nameOf(g)))
    top.append(
      ico('userMultiple'),
      words,
      el('span', 'me-pill', (en && g.titleEn) || g.titleFr || (m.member_badge ?? '')),
    )
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
    for (const a of g.announcements) {
      const n = el('div', 'me-ann')
      n.append(
        ico('megaphone', 'me-ico'),
        el('span', 'me-t', (en && a.titleEn) || a.titleFr),
        el('span', 'me-p', (en && a.bodyEn) || a.bodyFr),
      )
      if (a.link) n.append(link(m.view_page ?? '', a.link, 'btn btn-secondary btn-sm'))
      c.append(n)
    }
    const phone = el('label', 'check-row')
    const box2 = el('input', 'checkbox', undefined, { type: 'checkbox' })
    box2.checked = g.sharePhone
    box2.addEventListener(
      'change',
      () =>
        void api(`/me/groups/${g.id}/share-phone`, {
          method: 'PUT',
          body: { sharePhone: box2.checked },
        }),
    )
    phone.append(box2, el('span', 'me-p', m.share_phone ?? ''))
    c.append(phone)
    const acts = el('div', 'me-actions')
    acts.append(link(m.view_page ?? '', links.deptBase.replace('__KEY__', g.key)))
    acts.append(
      button(m.leave ?? '', 'btn btn-ghost btn-sm', (b) => {
        if (b.dataset.ask !== '1') {
          b.dataset.ask = '1'
          b.textContent = m.leave_ask ?? ''
          return
        }
        void api(`/me/groups/${g.id}`, { method: 'DELETE' }).then(reload)
      }),
    )
    c.append(acts)
    box.append(c)
  }

  for (const p of r.json.pending) {
    const c = el('div', 'me-card')
    c.dataset.tone = 'gold'
    const top = el('div', 'me-top')
    const words = el('div', 'grid')
    words.append(el('span', 'me-k', m.request_k), el('span', 'me-t', nameOf(p)))
    top.append(ico('clock'), words)
    c.append(top, el('p', 'me-p', m.request_p))
    c.append(
      button(
        m.request_withdraw ?? '',
        'btn btn-ghost btn-sm',
        () => void api(`/me/groups/requests/${p.id}`, { method: 'DELETE' }).then(reload),
      ),
    )
    box.append(c)
  }

  // The groups I can ask to join.
  const open = (dir.json.items ?? []).filter((g) => g.request?.status !== 'pending')
  if (dir.ok && open.length) {
    const head = el('div', 'me-head me-head-sub')
    head.append(ico('userRoundPlus'), el('h4', 'me-head-t', m.join_t ?? ''))
    box.append(head, el('p', 'me-p me-wide', m.join_p))
    for (const g of open) {
      const c = el('div', 'me-card')
      const top = el('div', 'me-top')
      const words = el('div', 'grid')
      words.append(el('span', 'me-t', nameOf(g)))
      top.append(ico('userMultiple'), words)
      c.append(top)
      const desc = (en && g.descriptionEn) || g.descriptionFr
      if (desc) c.append(el('p', 'me-p', desc))
      if (g.request?.status === 'declined')
        c.append(
          el(
            'p',
            'me-p',
            `${m.request_declined ?? ''}${g.request.message ? ` ${g.request.message}` : ''}`,
          ),
        )
      const form = el('div', 'me-link')
      form.hidden = true
      const share = el('label', 'check-row')
      const sb = el('input', 'checkbox', undefined, { type: 'checkbox' })
      share.append(sb, el('span', 'me-p', m.share_phone ?? ''))
      const err = el('span', 'me-p')
      err.setAttribute('role', 'status')
      form.append(
        share,
        button(m.request_send ?? '', 'btn btn-primary btn-sm', (b) => {
          b.disabled = true
          void api(`/me/groups/${g.id}/request`, { body: { sharePhone: sb.checked } }).then((x) => {
            if (x.ok) return reload()
            b.disabled = false
            err.textContent = x.status === 429 ? (m.link_rate ?? '') : (m.err ?? '')
          })
        }),
        err,
      )
      c.append(
        button(m.request_ask ?? '', 'btn btn-secondary btn-sm', (b) => {
          form.hidden = !form.hidden
          b.setAttribute('aria-expanded', String(!form.hidden))
        }),
        form,
      )
      box.append(c)
    }
  }
}
