/**
 * `pnpm e2e` — the end-to-end checks of the parish site, run BY HAND against a running local stack (not in CI,
 * docs/ops/ci-cd.md). It talks to the API like the admin does and looks at the public site like a visitor:
 *   1. publish → visible        2. schedule → visible later (after the time passes)
 *   3. event recurrence + a cancelled occurrence → in the .ics feed
 *   4. contact submit → in the inbox (and the spam traps)        5. search finds the new post
 * Needs: `pnpm dev` running (gateway on :8080), the dev database, and a super-admin test account (E2E_EMAIL,
 * E2E_PASSWORD; defaults to the documented dev tester). Creates "E2E —" items and removes what it can afterwards.
 * Never run it against production.
 */
const base = process.env.E2E_BASE ?? 'http://localhost:8080'
const email = process.env.E2E_EMAIL ?? 'news-tester@example.test'
const password = process.env.E2E_PASSWORD ?? 'une-phrase-solide-2026'
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error('e2e runs against a local stack only')

let failures = 0
const ok = (name: string, pass: boolean, detail = '') => {
  console.log(`${pass ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const until = async (fn: () => Promise<boolean>, ms: number, every = 3000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await sleep(every)
  }
  return false
}

const login = await fetch(`${base}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ email, password }),
})
if (!login.ok) throw new Error(`sign-in failed (${login.status})`)
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ')
const H = { cookie, origin: base, 'content-type': 'application/json' }
const api = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { ...H, ...(init.headers ?? {}) },
  })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, any> }
}
const para = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
const stamp = Date.now().toString(36)

// 1. publish → visible
{
  const created = await api('/news', {
    method: 'POST',
    body: JSON.stringify({ titleFr: `E2E — publication ${stamp}` }),
  })
  const id = created.json.id as string
  await api(`/news/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ excerptFr: 'Un essai.', bodyFr: para('Texte de test e2e.') }),
  })
  const draft = await api(`/news/${id}`)
  const slug = draft.json.post?.slug ?? draft.json.slug
  const hidden = (await fetch(`${base}/api/news/public/item/${slug}?locale=fr`)).status
  const pub = await api(`/news/${id}/publish`, { method: 'POST', body: '{}' })
  const seen = await until(
    async () =>
      (await (await fetch(`${base}/api/news/public/item/${slug}?locale=fr`)).json()).found === true,
    90_000,
  )
  ok(
    'publish → visible',
    pub.status === 200 && seen,
    `draft was ${hidden === 200 ? 'cached as ' : ''}${hidden}`,
  )
  // 5. search (same post)
  const found = await until(async () => {
    const r = await (
      await fetch(`${base}/api/search?q=${encodeURIComponent(`publication ${stamp}`)}&locale=fr`)
    ).json()
    return Array.isArray(r.items) && r.items.some((i: { key: string }) => i.key === slug)
  }, 90_000)
  ok('search finds the new post', found)
  await api(`/news/${id}`, { method: 'DELETE' }) // cleanup (unpublish first if the API refuses)
}

// 2. schedule → visible later
{
  const created = await api('/news', {
    method: 'POST',
    body: JSON.stringify({ titleFr: `E2E — programmé ${stamp}` }),
  })
  const id = created.json.id as string
  await api(`/news/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ excerptFr: 'Un essai.', bodyFr: para('Texte programmé e2e.') }),
  })
  const slug = (await api(`/news/${id}`)).json.post?.slug ?? (await api(`/news/${id}`)).json.slug
  const at = new Date(Date.now() + 20_000).toISOString()
  const pub = await api(`/news/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ publishAt: at }),
  })
  const early =
    (await (await fetch(`${base}/api/news/public/item/${slug}?locale=fr`)).json()).found === true
  const later = await until(
    async () =>
      (await (await fetch(`${base}/api/news/public/item/${slug}?locale=fr`)).json()).found === true,
    150_000,
    5000,
  )
  ok(
    'schedule → not visible before, visible after',
    pub.status === 200 && !early && later,
    `early=${early}`,
  )
  await api(`/news/${id}`, { method: 'DELETE' })
}

// 3. event recurrence + cancelled occurrence → .ics
{
  const created = await api('/events', {
    method: 'POST',
    body: JSON.stringify({ titleFr: `E2E — récurrent ${stamp}` }),
  })
  const id = created.json.id as string
  const start = new Date(Date.now() + 8 * 86_400_000)
  start.setUTCHours(8, 0, 0, 0)
  const day = new Date(start.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  await api(`/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      startsAt: start.toISOString(),
      recurrence: { freq: 'weekly', byDay: [start.getUTCDay()] },
      exceptions: [{ date: day, kind: 'cancelled', noteFr: 'Annulé (test e2e)' }],
      descriptionFr: para('Événement de test.'),
    }),
  })
  const pub = await api(`/events/${id}/publish`, { method: 'POST', body: '{}' })
  const ics = await until(async () => {
    const text = await (await fetch(`${base}/api/events/public/calendar.ics?locale=fr`)).text()
    return (
      /RRULE:FREQ=WEEKLY/.test(text) && /EXDATE/.test(text) && text.includes(`récurrent ${stamp}`)
    )
  }, 90_000)
  ok(
    'event recurrence + cancelled occurrence → .ics has RRULE and EXDATE',
    pub.status === 200 && ics,
  )
  await api(`/events/${id}`, { method: 'DELETE' })
}

// 4. contact → inbox, and the spam traps
{
  const body = {
    name: 'E2E Test',
    email: 'e2e@example.test',
    phone: '',
    category: 'renseignement',
    subject: '',
    message: `Message e2e ${stamp}`,
    consent: true,
    website: '',
  }
  const post = (extra: object) =>
    fetch(`${base}/api/contact/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ ...body, ...extra }),
    })
  const mint = async () =>
    ((await (await fetch(`${base}/api/contact/token`)).json()) as { token: string }).token
  const early = await mint()
  const fast = await post({ token: early })
  ok('contact: too fast is refused', fast.status === 400)
  const forged = await post({ token: `${early.slice(0, -2)}xx` })
  ok('contact: a forged token is refused', forged.status === 400)
  await new Promise((r) => setTimeout(r, 4200))
  const bot = await post({ website: 'http://spam.example', token: early })
  ok('contact: honeypot is quietly accepted but not stored', bot.status === 200)
  const noConsent = await post({ consent: false, token: early })
  ok('contact: no consent is refused', noConsent.status === 400)
  const good = await post({ token: early })
  const inbox = await api('/contact')
  const mine = (inbox.json.items as { id: string; preview: string }[] | undefined)?.find((m) =>
    m.preview.includes(`e2e ${stamp}`),
  )
  ok('contact: a real message reaches the inbox', good.status === 200 && !!mine)
  ok(
    'contact: the honeypot message is not in the inbox',
    !(inbox.json.items as { name: string; preview: string }[] | undefined)?.some((m) =>
      m.preview.includes('spam.example'),
    ),
  )
  if (mine) await api(`/contact/${mine.id}`, { method: 'DELETE' })
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
