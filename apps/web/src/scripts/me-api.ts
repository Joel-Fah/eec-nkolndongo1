/** The few helpers every « Mon espace » section needs: calls to /api/me/*, small DOM builders, dates. Private data: nothing is kept in storage. */
export type Msgs = Record<string, string>
export type Links = {
  agenda: string
  departments: string
  sunday: string
  account: string
  cancel: string
  eventBase: string
  deptBase: string
}
export type Ctx = { root: HTMLElement; msgs: Msgs; links: Links; lang: string }

export async function api<T = Record<string, unknown>>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: T }> {
  try {
    const res = await fetch(`/api${path}`, {
      method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin',
      headers: init?.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
    return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as T }
  } catch {
    return { ok: false, status: 0, json: {} as T }
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}
export const fill = (tpl: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((o, [k, v]) => o.replace(`{${k}}`, String(v)), tpl)

/** « samedi 7 novembre » from a YYYY-MM-DD day or an ISO instant (Douala time for instants). */
export function dayText(v: string, lang: string, withTime = false) {
  const date = v.length === 10 ? new Date(`${v}T12:00:00Z`) : new Date(v)
  return new Intl.DateTimeFormat(lang, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(v.length === 10 ? { timeZone: 'UTC' } : { timeZone: 'Africa/Douala' }),
    ...(withTime && v.length > 10 ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function button(
  label: string,
  cls = 'btn btn-secondary btn-sm',
  onClick?: (b: HTMLButtonElement) => void,
) {
  const b = el('button', cls, label, { type: 'button' })
  if (onClick) b.addEventListener('click', () => onClick(b))
  return b
}
export function link(label: string, href: string, cls = 'btn btn-secondary btn-sm') {
  return el('a', cls, label, { href })
}
/** An empty state: a quiet icon-less panel with a title, a line and one way forward. */
export function empty(title: string, text: string, action?: HTMLElement) {
  const d = el('div', 'me-card me-empty')
  d.append(el('strong', '', title), el('span', 'me-m', text))
  if (action) d.append(action)
  return d
}
export const done = (box: HTMLElement) => box.removeAttribute('aria-busy')

/** The icons the page drew at build time (data-icons), so no icon code ships in the scripts. */
let icons: Record<string, string> = {}
export const setIcons = (map: Record<string, string>) => {
  icons = map
}
export function ico(name: string, cls = 'me-ico') {
  const s = el('span', cls)
  s.setAttribute('aria-hidden', 'true')
  s.innerHTML = icons[name] ?? ''
  return s
}

export type Profile = {
  seed: number
  photo: { url: string | null }
  completeness: { filled: number; total: number; complete: boolean }
}
/** One read of the profile shared by the welcome and the home; forgotten when the profile changes. */
let profileP: ReturnType<typeof api<Profile>> | null = null
export const profile = () => {
  profileP ??= api<Profile>('/me/profile')
  return profileP
}
export const forgetProfile = () => {
  profileP = null
}
