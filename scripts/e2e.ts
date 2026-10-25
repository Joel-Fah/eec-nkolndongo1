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

// 6. registration → waitlist → cancellation promotes   7. campaign: only validated totals are public   8. bulletin assembly source
{
  const f = await api('/registrations/forms', {
    method: 'POST',
    body: JSON.stringify({
      titleFr: `E2E — inscription ${stamp}`,
      eventSlug: `e2e-${stamp}`,
      eventDate: '2099-01-01',
      capacity: 1,
      waitlist: true,
    }),
  })
  const id = f.json.id as string
  await api(`/registrations/forms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'published' }),
  })
  const slug = ((await api(`/registrations/forms/${id}`)).json.slug as string) ?? ''
  const sign = async () =>
    ((await (await fetch(`${base}/api/registrations/token`)).json()) as { token: string }).token
  const token = await sign()
  await sleep(4300)
  const submit = (n: number) =>
    fetch(`${base}/api/registrations/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        slug,
        name: `E2E ${n}`,
        phone: `65500010${n}`,
        partySize: 1,
        consent: true,
        website: '',
        token,
        answers: {},
        children: [],
        guardian: false,
      }),
    }).then(async (r) => ({ status: r.status, json: (await r.json()) as Record<string, any> }))
  const first = await submit(1)
  const second = await submit(2)
  ok('registration: the first person is confirmed', first.json.status === 'confirmed')
  ok('registration: the second goes on the waitlist', second.json.status === 'waitlist')
  const cancelled = await fetch(`${base}/api/registrations/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ token: first.json.cancelToken }),
  })
  const people = await api(`/registrations/forms/${id}/registrations`)
  const statuses = (people.json.items as { name: string; status: string }[]).map(
    (r) => `${r.name}:${r.status}`,
  )
  ok(
    'registration: cancelling promotes the next person',
    cancelled.status === 200 && statuses.includes('E2E 2:confirmed'),
    statuses.join(' '),
  )
  await api(`/registrations/forms/${id}`, { method: 'DELETE' })

  const c = await api('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      titleFr: `E2E — moissons ${stamp}`,
      startsOn: '2099-01-01',
      endsOn: '2099-01-08',
    }),
  })
  const cid = c.json.id as string
  await api(`/campaigns/${cid}`, {
    method: 'PATCH',
    body: JSON.stringify({ goalXaf: 1000, state: 'published' }),
  })
  const e1 = await api(`/campaigns/${cid}/progress`, {
    method: 'POST',
    body: JSON.stringify({
      amountXaf: 400,
      receivedOn: new Date().toISOString().slice(0, 10),
      note: 'E2E secret',
    }),
  })
  const before = (await api('/campaigns/public/current?locale=fr&asOf=2099-01-05')).json.campaign
  ok('campaign: an amount not yet validated is not public', before?.raised === 0)
  await api(`/campaigns/progress/${e1.json.id}/validate`, {
    method: 'POST',
    body: JSON.stringify({ validated: true }),
  })
  const after = (await api('/campaigns/public/current?locale=fr&asOf=2099-01-05')).json.campaign
  ok('campaign: once validated it is in the total', after?.raised === 400 && after?.percent === 40)
  ok(
    'campaign: no row or note reaches the public JSON',
    !JSON.stringify(after).includes('E2E secret'),
  )
  await api(`/campaigns/${cid}`, { method: 'DELETE' })
}

// 9. Sunday report: attendance, an offering line, a Moissons line feeds ONE unvalidated campaign entry, closing locks the Sunday
{
  const hints = (await api('/sundays/hints')).json as { lastSunday: string }
  const day = hints.lastSunday
  const c = await api('/campaigns', {
    method: 'POST',
    body: JSON.stringify({
      titleFr: `E2E — dimanche ${stamp}`,
      startsOn: '2099-01-01',
      endsOn: '2099-01-08',
    }),
  })
  const cid = c.json.id as string
  const att = await api(`/sundays/reports/${day}/attendance`, {
    method: 'PUT',
    body: JSON.stringify({ men: 10, women: 12, children: 5 }),
  })
  ok('sundays: attendance is saved', att.status === 200)
  const bad = await api('/sundays/reports/2026-10-24/attendance', {
    method: 'PUT',
    body: JSON.stringify({ men: 1 }),
  })
  ok('sundays: a day that is not a Sunday must be named first', bad.status === 400)
  const nonsense = await api('/sundays/reports/2026-02-30/attendance', {
    method: 'PUT',
    body: JSON.stringify({ men: 1 }),
  })
  ok('sundays: an impossible date is refused', nonsense.status === 400)
  const line = await api(`/sundays/reports/${day}/offerings`, {
    method: 'POST',
    body: JSON.stringify({ purpose: 'moissons', amountXaf: 7777, groupId: null, campaignId: cid }),
  })
  const entries = (await api(`/campaigns/${cid}/progress`)).json.items as {
    amountXaf: number
    validated: boolean
  }[]
  ok(
    'sundays: a Moissons line creates one unvalidated campaign entry',
    line.status === 201 && entries.length === 1 && entries[0]?.validated === false,
  )
  await api(`/sundays/reports/${day}/close`, {
    method: 'POST',
    body: JSON.stringify({ closed: true }),
  })
  const locked = await api(`/sundays/reports/${day}/attendance`, {
    method: 'PUT',
    body: JSON.stringify({ men: 11 }),
  })
  ok('sundays: a closed Sunday refuses changes', locked.status === 409)
  // The reminder for that Sunday (if the account is old enough to have one) is done once the Sunday is closed.
  const feed = (await api('/notifications')).json as {
    items: { id: string; kind: string; params: { date?: string }; resolved: boolean }[]
    unread: number
  }
  ok(
    'notifications: the list answers',
    Array.isArray(feed.items) && typeof feed.unread === 'number',
  )
  const mine = feed.items.find((n) => n.kind === 'sunday_report_due' && n.params.date === day)
  ok('notifications: a closed Sunday is not asked for again', !mine || mine.resolved)
  const hide = await api('/notifications/dismiss', {
    method: 'POST',
    body: JSON.stringify({ ids: mine ? [mine.id] : ['00000000-0000-4000-8000-000000000000'] }),
  })
  ok('notifications: a notification can be hidden', hide.status === 200)
  await api(`/sundays/reports/${day}/close`, {
    method: 'POST',
    body: JSON.stringify({ closed: false }),
  })
  await api(`/sundays/offerings/${line.json.id}`, { method: 'DELETE' })
  ok(
    'sundays: deleting the line removes the unvalidated entry',
    ((await api(`/campaigns/${cid}/progress`)).json.items as unknown[]).length === 0,
  )
  await api(`/campaigns/${cid}`, { method: 'DELETE' })
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
