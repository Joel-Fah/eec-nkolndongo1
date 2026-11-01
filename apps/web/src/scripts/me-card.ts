/**
 * The Communion card in Mon espace (decision 0050): a portrait card with the year's twelve months, the streak, the next Holy Supper with its
 * preparation week, what is expected (never a debt), an excuse the member can declare, and the QR code the door checks. The last answer is
 * kept in IndexedDB so the card still opens on Sunday morning without network, marked « vérifiée le … »; it is erased on sign-out.
 */
import { api, dayText, el, fill, ico, type Msgs } from './me-api'

export type Card = {
  state: 'valid' | 'expired' | 'suspended'
  validUntil: string
  code: string
  name: string
  firstName: string
  months: { month: string; sunday: string; state: string }[]
  streak: number
  next: {
    month: string
    sunday: string
    prep: { from: string; to: string }
    inPrep: boolean
    signed: boolean
    excused: boolean
  }
  expected: {
    total: number
    lines: { kind: string; key: string; nameFr: string; nameEn: string; amountXaf: number }[]
  } | null
  qr: string | null
  checkedAt: string
}
const DB = 'eec-card'
const KEEP_MS = 45 * 86_400_000

const open = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('card')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
async function put(card: Card | null) {
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('card', 'readwrite')
      if (card) tx.objectStore('card').put({ card, savedAt: Date.now() }, 'mine')
      else tx.objectStore('card').delete('mine')
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
    })
    db.close()
  } catch {
    // storage blocked: the card simply needs the network
  }
}
/** The last card seen on this device, if it is still within its validity and 45 days. */
export async function cachedCard(): Promise<Card | null> {
  try {
    const db = await open()
    const got = await new Promise<{ card: Card; savedAt: number } | undefined>((res, rej) => {
      const r = db.transaction('card').objectStore('card').get('mine')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    db.close()
    if (!got || Date.now() - got.savedAt > KEEP_MS) return null
    return got.card
  } catch {
    return null
  }
}
export const forgetCard = () => put(null)

/** The card from the network (and kept), or the one kept on this device when there is no network. */
export async function loadCard(): Promise<{ card: Card; offline: boolean } | null> {
  const r = await api<{ card: Card | null }>('/communion/me')
  if (r.ok) {
    if (!r.json.card) {
      await forgetCard()
      return null
    }
    await put(r.json.card)
    return { card: r.json.card, offline: false }
  }
  if (r.status === 0) {
    const kept = await cachedCard()
    return kept ? { card: kept, offline: true } : null
  }
  return null
}

const GLYPH: Record<string, string> = {
  signed: '✓',
  excused: '⏸',
  missed: '–',
  open: '•',
  future: '',
  before: '',
}

export function cardEl(
  card: Card,
  o: { msgs: Msgs; lang: string; offline: boolean; onChange: () => void },
) {
  const { msgs: m, lang } = o
  const c = el('div', 'me-card me-comm')
  c.dataset.state = card.state
  const top = el('div', 'me-row')
  const pill = el('span', 'me-pill', m[`card_state_${card.state}`] ?? card.state)
  if (card.state !== 'valid') pill.dataset.tone = card.state === 'suspended' ? 'off' : 'warn'
  top.append(el('span', 'me-k', m.card_k), pill)
  const face = el('div', 'me-comm-face')
  const head = el('div', 'me-comm-head')
  head.append(ico('studentCard', 'me-comm-ico'), el('span', 'me-comm-parish', m.card_parish))
  const who = el('div', 'me-comm-who')
  who.append(el('span', 'me-comm-name', card.name), el('span', 'me-comm-code', card.code))
  face.append(head, who)
  const year = el('ol', 'me-comm-grid')
  const fmt = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' })
  for (const mo of card.months) {
    const li = el('li', '', undefined, { 'data-s': mo.state })
    const label = `${fmt.format(new Date(`${mo.month}-01T12:00:00Z`))} : ${m[`card_m_${mo.state}`] ?? ''}`
    li.setAttribute('aria-label', label)
    li.setAttribute('title', label)
    li.append(
      el('span', 'me-comm-mo', fmt.format(new Date(`${mo.month}-01T12:00:00Z`))),
      el('span', 'me-comm-g', GLYPH[mo.state] ?? ''),
    )
    year.append(li)
  }
  face.append(year)
  const status =
    card.state === 'valid'
      ? fill(m.card_valid_until ?? '', { date: dayText(card.validUntil, lang) })
      : card.state === 'expired'
        ? fill(m.card_expired ?? '', { date: dayText(card.validUntil, lang) })
        : (m.card_suspended ?? '')
  face.append(el('span', 'me-comm-tag', status))
  c.append(top, face)

  if (card.state === 'valid') {
    c.append(
      el(
        'span',
        'me-t',
        card.streak ? fill(m.card_streak ?? '', { n: card.streak }) : (m.card_streak_none ?? ''),
      ),
      el(
        'p',
        'me-p',
        `${fill(m.card_next ?? '', { date: dayText(card.next.sunday, lang) })} · ${fill(m.card_prep ?? '', { from: dayText(card.next.prep.from, lang), to: dayText(card.next.prep.to, lang) })}`,
      ),
    )
    if (!card.next.signed && !o.offline) {
      const b = el(
        'button',
        'btn btn-ghost btn-sm',
        card.next.excused ? m.card_unexcuse : m.card_excuse,
        { type: 'button' },
      )
      b.addEventListener('click', () => {
        b.disabled = true
        void api('/communion/me/excuse', {
          method: 'PUT',
          body: { month: card.next.month, excused: !card.next.excused },
        }).then(() => o.onChange())
      })
      if (card.next.excused) c.append(el('p', 'me-p', m.card_excused_now))
      c.append(b)
    }
    if (card.expected) {
      const lines = card.expected.lines
        .map((l) => (l.kind === 'group' ? `${(lang === 'en' && l.nameEn) || l.nameFr}` : ''))
        .filter(Boolean)
      c.append(
        el(
          'p',
          'me-p',
          `${m.card_expected}: ${new Intl.NumberFormat(lang).format(card.expected.total)} FCFA${lines.length ? ` (${lines.join(', ')})` : ''}. ${m.card_expected_p}`,
        ),
      )
    }
    if (card.qr) {
      const q = el('div', 'me-comm-qr')
      q.setAttribute('role', 'img')
      q.setAttribute('aria-label', m.card_qr_t ?? '')
      q.innerHTML = card.qr
      c.append(q, el('p', 'me-p', m.card_qr_t))
    }
  }
  if (o.offline)
    c.append(
      el('p', 'me-p', fill(m.card_offline ?? '', { date: dayText(card.checkedAt, lang, true) })),
    )
  return c
}
