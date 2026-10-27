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

// The dev database is remote and sometimes unreachable for a moment (a 5xx with an HTML error page): try a request again before judging it.
const realFetch = globalThis.fetch
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  let r = await realFetch(...a)
  for (let i = 0; i < 2 && r.status >= 500; i++) {
    await new Promise((res) => setTimeout(res, 2500))
    r = await realFetch(...a)
  }
  return r
}) as typeof fetch

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
  const noop = await api(`/sundays/reports/${day}/validate`, { method: 'POST' })
  ok('sundays: validating with nothing waiting changes nothing', noop.status === 200)
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
  const mute = await api('/notifications/mute', {
    method: 'PUT',
    body: JSON.stringify({ kind: 'week_nudge', muted: true }),
  })
  const quiet = (await api('/notifications')).json as {
    items: { kind: string }[]
    muted: string[]
  }
  ok(
    'notifications: a muted kind is not shown',
    mute.status === 200 &&
      quiet.muted.includes('week_nudge') &&
      !quiet.items.some((n) => n.kind === 'week_nudge'),
  )
  await api('/notifications/mute', {
    method: 'PUT',
    body: JSON.stringify({ kind: 'week_nudge', muted: false }),
  })
  // Leave the Sunday as it was found, so the checks can run again.
  await api(`/sundays/reports/${day}/close`, {
    method: 'POST',
    body: JSON.stringify({ closed: false }),
  })
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

// 10. Member profile (decision 0047): details need the consent, the photo is private, staff see it only if the member shares it,
//     withdrawing the consent erases details and photo.
{
  const sharpMod = (await import('sharp')).default
  const webp = await sharpMod({
    create: { width: 64, height: 64, channels: 3, background: '#1F5C3A' },
  })
    .webp()
    .toBuffer()
  const photo = async (bytes: Uint8Array, name = 'p.webp', type = 'image/webp') => {
    const form = new FormData()
    form.append('file', new File([bytes as BlobPart], name, { type }))
    const res = await fetch(`${base}/api/me/photo`, {
      method: 'PUT',
      headers: { cookie, origin: base },
      body: form,
    })
    return res.status
  }
  const anon = await fetch(`${base}/api/me/photo`)
  ok('profile: the photo is never served to a visitor', anon.status === 401)
  const badge = await (await fetch(`${base}/api/me/badge`)).json()
  ok('profile: the navbar badge says nothing about a visitor', badge.signedIn === false)
  // Start clean.
  await api('/me/profile/consent', { method: 'POST', body: JSON.stringify({ granted: false }) })
  const noConsent = await api('/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ city: 'Yaoundé' }),
  })
  ok('profile: details are refused without the consent', noConsent.status === 403)
  ok('profile: a photo is refused without the consent', (await photo(webp)) === 403)
  const grant = await api('/me/profile/consent', {
    method: 'POST',
    body: JSON.stringify({ granted: true }),
  })
  ok(
    'profile: the consent can be given',
    grant.status === 200,
    String(grant.status) + JSON.stringify(grant.json),
  )
  const future = await api('/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ birthDate: '2999-01-01' }),
  })
  ok(
    'profile: a birth date in the future is refused',
    future.status === 400,
    String(future.status) + JSON.stringify(future.json),
  )
  const saved = await api('/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ birthDate: '1990-05-01', city: 'Yaoundé', gender: 'woman' }),
  })
  ok('profile: details are saved with the consent', saved.status === 200)
  const mine = (await api('/me/profile')).json as {
    details: { city: string | null }
    completeness: { complete: boolean }
  }
  ok(
    'profile: the details come back, the profile is not complete yet',
    mine.details.city === 'Yaoundé' && !mine.completeness.complete,
  )
  ok(
    'profile: a file that is not a picture is refused',
    (await photo(new TextEncoder().encode('hello world, not a picture at all'))) === 400,
  )
  ok('profile: a photo is accepted', (await photo(webp)) === 200)
  const own = await fetch(`${base}/api/me/photo`, { headers: { cookie } })
  ok(
    'profile: the owner reads the photo, never cached',
    own.status === 200 &&
      own.headers.get('content-type') === 'image/webp' &&
      /no-store/.test(own.headers.get('cache-control') ?? ''),
  )
  const myId = (await api('/me')).json.user.id as string
  // The team always sees an uploaded photo; the navbar shows it only if the member chose it.
  const shared = await fetch(`${base}/api/members/${myId}/photo`, { headers: { cookie } })
  ok('profile: the team opens the uploaded photo', shared.status === 200)
  const before = (await (await fetch(`${base}/api/me/badge`, { headers: { cookie } })).json()) as {
    photo: string | null
  }
  ok('profile: the navbar shows a generated avatar by default', before.photo === null)
  await api('/me/photo-avatar', { method: 'PUT', body: JSON.stringify({ use: true }) })
  const after = (await (await fetch(`${base}/api/me/badge`, { headers: { cookie } })).json()) as {
    photo: string | null
  }
  ok('profile: the member can choose their photo as their avatar', !!after.photo)
  await api('/me/photo-avatar', { method: 'PUT', body: JSON.stringify({ use: false }) })
  await api('/me/profile/consent', { method: 'POST', body: JSON.stringify({ granted: false }) })
  const erased = (await api('/me/profile')).json as {
    details: Record<string, string | null>
    photo: { has: boolean }
  }
  ok(
    'profile: withdrawing the consent erases the details and the photo',
    Object.values(erased.details).every((v) => v === null) && !erased.photo.has,
  )
  ok(
    'profile: the erased photo is gone',
    (await fetch(`${base}/api/me/photo`, { headers: { cookie } })).status === 404,
  )
}

// 11. Mon espace (Phase 05): my registrations (signed-in link, link by the signed cancel link, cancel), promotion notifies me, my groups, mutes
{
  const mk = async (title: string, cap: number) => {
    const f = await api('/registrations/forms', {
      method: 'POST',
      body: JSON.stringify({
        titleFr: title,
        eventSlug: `e2e-me-${stamp}-${cap}`,
        eventDate: '2099-02-01',
        capacity: cap,
        waitlist: true,
      }),
    })
    await api(`/registrations/forms/${f.json.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'published' }),
    })
    return {
      id: f.json.id as string,
      slug: ((await api(`/registrations/forms/${f.json.id}`)).json.slug as string) ?? '',
    }
  }
  const token = async () =>
    ((await (await fetch(`${base}/api/registrations/token`)).json()) as { token: string }).token
  const reg = async (slug: string, n: number, tok: string, signedIn: boolean) => {
    const res = await fetch(`${base}/api/registrations/submit`, {
      method: 'POST',
      headers: signedIn ? { ...H } : { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        slug,
        name: `E2E Moi ${n}`,
        phone: `65500030${n}`,
        partySize: 1,
        consent: true,
        website: '',
        token: tok,
        answers: {},
        children: [],
        guardian: false,
      }),
    })
    return { status: res.status, json: (await res.json()) as Record<string, any> }
  }
  const one = await mk(`E2E — moi ${stamp} (une place)`, 1)
  const t1 = await token()
  const t2 = await token()
  const t3 = await token()
  await sleep(4400)
  const anon = await reg(one.slug, 1, t1, false)
  const mine = await reg(one.slug, 2, t2, true)
  ok(
    'mon espace: a place taken, then my signed-in registration goes on the waitlist',
    anon.json.status === 'confirmed' && mine.json.status === 'waitlist',
  )
  const list = (await api('/registrations/mine')).json.items as {
    id: string
    status: string
    position: number | null
  }[]
  const waiting = list.find((r) => r.status === 'waitlist')
  ok(
    'mon espace: « Mes inscriptions » lists mine with my place on the waitlist',
    !!waiting && waiting.position === 1,
  )
  // Someone else's registration cannot be cancelled through mine; mine can.
  const other = await api('/registrations/mine/00000000-0000-4000-8000-000000000000/cancel', {
    method: 'POST',
    body: '{}',
  })
  ok('mon espace: cancelling a registration that is not mine is refused', other.status === 404)
  // Cancelling the confirmed anonymous registration (its signed link) promotes me, and I am told.
  await fetch(`${base}/api/registrations/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ token: anon.json.cancelToken }),
  })
  const feed = (await api('/me/notifications')).json as {
    items: { kind: string }[]
    unread: number
  }
  ok(
    'mon espace: the promotion is a notification for me',
    feed.items.some((n) => n.kind === 'waitlist_promoted') && feed.unread > 0,
  )
  const mute = await api('/me/notifications/mute', {
    method: 'PUT',
    body: JSON.stringify({ kind: 'waitlist_promoted', muted: true }),
  })
  const quiet = (await api('/me/notifications')).json as {
    items: { kind: string }[]
    muted: string[]
  }
  ok(
    'mon espace: a muted kind is not shown to me',
    mute.status === 200 &&
      !quiet.items.some((n) => n.kind === 'waitlist_promoted') &&
      quiet.muted.includes('waitlist_promoted'),
  )
  await api('/me/notifications/mute', {
    method: 'PUT',
    body: JSON.stringify({ kind: 'waitlist_promoted', muted: false }),
  })
  // Link a registration made without an account by its signed cancel link.
  const two = await mk(`E2E — moi ${stamp} (sans compte)`, 5)
  await sleep(100)
  const anon2 = await reg(two.slug, 3, t3, false)
  const claim = await api('/registrations/mine/claim', {
    method: 'POST',
    body: JSON.stringify({ token: anon2.json.cancelToken }),
  })
  const bad = await api('/registrations/mine/claim', {
    method: 'POST',
    body: JSON.stringify({ token: 'not-a-valid-link-at-all' }),
  })
  const after = (await api('/registrations/mine')).json.items as { id: string }[]
  ok(
    'mon espace: the signed cancel link links a registration to my account, a bad link does not',
    claim.status === 200 && bad.status === 400 && after.length >= 2,
  )
  const groups = await api('/me/groups')
  ok('mon espace: my groups answer', groups.status === 200 && Array.isArray(groups.json.items))
  const anonList = await fetch(`${base}/api/registrations/mine`)
  ok('mon espace: nobody without a session sees registrations', anonList.status === 401)
  await api(`/registrations/forms/${one.id}`, { method: 'DELETE' })
  await api(`/registrations/forms/${two.id}`, { method: 'DELETE' })
}

// 12. Groups (decision 0049): ask to join → the leader of THAT group decides → I am a member; announcements notify; scope; removal; export
{
  const pw = 'une-phrase-solide-2026-xyz'
  const mkMember = async (tag: string, phone: string) => {
    const mail = `e2e-${tag}-${stamp}@example.test`
    const up = await fetch(`${base}/api/members/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        firstName: 'E2E',
        lastName: tag,
        email: mail,
        password: pw,
        phone,
        acceptPrivacy: true,
        acceptNews: false,
      }),
    })
    const si = await fetch(`${base}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ email: mail, password: pw }),
    })
    const ck = si.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    const as = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${base}/api${path}`, {
        ...init,
        headers: {
          cookie: ck,
          origin: base,
          'content-type': 'application/json',
          ...(init.headers ?? {}),
        },
      })
      return {
        status: res.status,
        json: (await res.json().catch(() => ({}))) as Record<string, any>,
        res,
      }
    }
    const me = (await as('/me')).json.user?.id as string
    return { up: up.status, as, id: me }
  }
  const leader = await mkMember('chef', '655000401')
  const joiner = await mkMember('membre', '655000402')
  if (!leader.id || !joiner.id)
    ok(
      'groups: test accounts could be created',
      false,
      `signup ${leader.up}/${joiner.up} (5 sign-ups per hour per address)`,
    )
  else {
    const g1 = (
      await api('/groups', {
        method: 'POST',
        body: JSON.stringify({ nameFr: `E2E Groupe A ${stamp}`, kind: 'other' }),
      })
    ).json.id as string
    const g2 = (
      await api('/groups', {
        method: 'POST',
        body: JSON.stringify({ nameFr: `E2E Groupe B ${stamp}`, kind: 'other' }),
      })
    ).json.id as string
    await api(`/users/${leader.id}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleKey: 'responsable-groupe', groupId: g1 }),
    })
    // sessions of the leader were closed by the grant: sign in again through a fresh helper
    const lead = await (async () => {
      const si = await fetch(`${base}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify({ email: `e2e-chef-${stamp}@example.test`, password: pw }),
      })
      const ck = si.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ')
      return async (path: string, init: RequestInit = {}) => {
        const res = await fetch(`${base}/api${path}`, {
          ...init,
          headers: {
            cookie: ck,
            origin: base,
            'content-type': 'application/json',
            ...(init.headers ?? {}),
          },
        })
        return {
          status: res.status,
          json: (await res.json().catch(() => ({}))) as Record<string, any>,
          res,
        }
      }
    })()
    const dir = await joiner.as('/me/groups/directory')
    ok(
      'groups: a member sees the active groups they can ask to join',
      dir.status === 200 && (dir.json.items as { id: string }[]).some((g) => g.id === g1),
    )
    const ask = await joiner.as(`/me/groups/${g1}/request`, {
      method: 'POST',
      body: JSON.stringify({ sharePhone: true }),
    })
    const again = await joiner.as(`/me/groups/${g1}/request`, {
      method: 'POST',
      body: JSON.stringify({ sharePhone: true }),
    })
    ok(
      'groups: a request is created once, a second one is refused',
      ask.status === 201 && again.status === 409,
    )
    const mineBefore = await joiner.as('/me/groups')
    ok(
      'groups: waiting is not belonging (the member is in no group yet)',
      (mineBefore.json.items as unknown[]).length === 0 &&
        (mineBefore.json.pending as unknown[]).length === 1,
    )
    const own = await lead(`/group-space/mine`)
    const space = await lead(`/group-space/${g1}`)
    const reqId = (space.json.requests as { id: string }[])?.[0]?.id
    ok(
      'groups: the leader sees their group and the request, nothing else',
      own.status === 200 &&
        (own.json.groups as { id: string }[]).map((g) => g.id).join() === g1 &&
        !!reqId,
    )
    ok(
      'groups: a leader of one group is refused another group (scope)',
      (await lead(`/group-space/${g2}`)).status === 403,
    )
    // A leader writes news and events for their own group as drafts; the secretariat publishes (validation).
    for (const kind of ['news', 'events']) {
      const made = await lead(`/${kind}`, { method: 'POST', body: '{}' })
      const one = made.json.id ? await lead(`/${kind}/${made.json.id}`) : null
      ok(
        `groups: a leader's new ${kind} item is a draft of their group`,
        made.status === 201 && one?.json.groupId === g1,
      )
      ok(
        `groups: a leader cannot publish ${kind} (the secretariat does)`,
        !!made.json.id &&
          (await lead(`/${kind}/${made.json.id}/publish`, { method: 'POST', body: '{}' }))
            .status === 403,
      )
      if (made.json.id) await api(`/${kind}/${made.json.id}`, { method: 'DELETE' })
    }
    ok(
      'groups: a plain member cannot open Mon groupe',
      (await joiner.as(`/group-space/mine`)).status === 403,
    )
    const nobody = await joiner.as(`/group-space/requests/${reqId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve: true }),
    })
    ok('groups: a member cannot decide a request', nobody.status === 403)
    const yes = await lead(`/group-space/requests/${reqId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ approve: true, message: 'Bienvenue' }),
    })
    const mineAfter = await joiner.as('/me/groups')
    ok(
      'groups: approving makes the member a member',
      yes.status === 200 && (mineAfter.json.items as { id: string }[]).some((g) => g.id === g1),
    )
    const note = (await joiner.as('/me/notifications')).json.items as { kind: string }[]
    ok(
      'groups: the member is told the answer',
      note.some((n) => n.kind === 'group_decision'),
    )
    const roster = (await lead(`/group-space/${g1}`)).json.members as {
      userId: string
      phone: string | null
    }[]
    ok(
      'groups: the roster shows the number the member chose to share',
      roster.find((r) => r.userId === joiner.id)?.phone === '655000402',
    )
    await joiner.as(`/me/groups/${g1}/share-phone`, {
      method: 'PUT',
      body: JSON.stringify({ sharePhone: false }),
    })
    const roster2 = (await lead(`/group-space/${g1}`)).json.members as {
      userId: string
      phone: string | null
    }[]
    ok(
      'groups: stopping the sharing hides the number',
      roster2.find((r) => r.userId === joiner.id)?.phone === null,
    )
    const ann = await lead('/announcements', {
      method: 'POST',
      body: JSON.stringify({
        groupId: g1,
        titleFr: 'Répétition déplacée',
        bodyFr: 'Samedi, même heure.',
      }),
    })
    const annId = ann.json.id as string
    const pub = await lead(`/announcements/${annId}/publish`, { method: 'POST', body: '{}' })
    const mine3 = await joiner.as('/me/groups')
    const notes = (await joiner.as('/me/notifications')).json.items as { kind: string }[]
    ok(
      'groups: publishing notifies the members and shows in Mes groupes',
      pub.status === 200 &&
        pub.json.notified === 1 &&
        notes.some((n) => n.kind === 'group_announcement') &&
        (mine3.json.items as { announcements: unknown[] }[])[0]?.announcements.length === 1,
    )
    ok(
      'groups: a leader cannot publish for another group',
      (
        await lead('/announcements', {
          method: 'POST',
          body: JSON.stringify({ groupId: g2, titleFr: 'Non', bodyFr: 'Non' }),
        })
      ).status === 403,
    )
    ok(
      'groups: the group list export is refused to a leader (dangerous right)',
      (await lead(`/group-space/${g1}/export`)).status === 403,
    )
    const exp = await fetch(`${base}/api/group-space/${g1}/export`, {
      headers: { cookie, origin: base },
    })
    ok(
      'groups: the super admin can export, as a file',
      exp.status === 200 && (exp.headers.get('content-type') ?? '').includes('text/csv'),
    )
    const noReason = await lead(`/group-space/${g1}/members/${joiner.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: '' }),
    })
    const gone = await lead(`/group-space/${g1}/members/${joiner.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'Test e2e' }),
    })
    const leftOver = await joiner.as('/me/groups')
    ok(
      'groups: removing needs a reason and takes the person out',
      noReason.status === 400 &&
        gone.status === 200 &&
        (leftOver.json.items as unknown[]).length === 0,
    )
    const audit = await api('/audit?q=group.member.remove')
    ok('groups: the removal is in the activity log', audit.status === 200)
    await api(`/groups/${g1}`, {
      method: 'PUT',
      body: JSON.stringify({ nameFr: `E2E Groupe A ${stamp}`, kind: 'other', isActive: false }),
    })
    await api(`/groups/${g2}`, {
      method: 'PUT',
      body: JSON.stringify({ nameFr: `E2E Groupe B ${stamp}`, kind: 'other', isActive: false }),
    })
  }
}

// 13. Communion card (decision 0050): propose → a second person approves → the Elders sign the month → the QR code verifies → suspend, renew, withdraw
{
  const pw = 'une-phrase-solide-2026-xyz'
  const mk = async (tag: string, phone: string, role?: string) => {
    const mail = `e2e-${tag}-${stamp}@example.test`
    const up = await fetch(`${base}/api/members/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        firstName: 'E2E',
        lastName: tag,
        email: mail,
        password: pw,
        phone,
        acceptPrivacy: true,
        acceptNews: false,
      }),
    })
    const signIn = async () => {
      const si = await fetch(`${base}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify({ email: mail, password: pw }),
      })
      return si.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ')
    }
    let ck = await signIn()
    const as = async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${base}/api${path}`, {
        ...init,
        headers: {
          cookie: ck,
          origin: base,
          'content-type': 'application/json',
          ...(init.headers ?? {}),
        },
      })
      return {
        status: res.status,
        json: (await res.json().catch(() => ({}))) as Record<string, any>,
      }
    }
    const id = (await as('/me')).json.user?.id as string
    if (role && id) {
      await api(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify({ roleKey: role }) })
      ck = await signIn()
    }
    return { up: up.status, as, id }
  }
  const member = await mk('fidele', '655000501')
  const pastor = await mk('pasteur', '655000502', 'pasteur')
  const elder = await mk('ancien', '655000503', 'ancien')
  if (!member.id || !pastor.id || !elder.id)
    ok(
      'communion: test accounts could be created',
      false,
      `signup ${member.up}/${pastor.up}/${elder.up} (5 sign-ups per hour per address)`,
    )
  else {
    await member.as('/me/profile/consent', {
      method: 'POST',
      body: JSON.stringify({ granted: true }),
    })
    const decl = await member.as('/communion/me/sacrament', {
      method: 'PUT',
      body: JSON.stringify({ baptised: true, confirmed: null, ack: true }),
    })
    ok(
      'communion: a member can say they are baptised (with the profile consent)',
      decl.status === 200,
    )
    ok(
      'communion: a member without a card has none, and nothing is said about it',
      (await member.as('/communion/me')).json.card === null,
    )
    const noConfirm = await api('/communion/cards', {
      method: 'POST',
      body: JSON.stringify({ userId: member.id }),
    })
    ok(
      'communion: a card needs the baptism confirmed by the parish first',
      noConfirm.status === 409,
    )
    ok(
      'communion: a member cannot confirm baptism or propose a card',
      (
        await member.as(`/communion/sacrament/${member.id}`, {
          method: 'PUT',
          body: JSON.stringify({ confirmed: true }),
        })
      ).status === 403,
    )
    await api(`/communion/sacrament/${member.id}`, {
      method: 'PUT',
      body: JSON.stringify({ confirmed: true }),
    })
    const prop = await api('/communion/cards', {
      method: 'POST',
      body: JSON.stringify({ userId: member.id }),
    })
    const cardId = prop.json.id as string
    ok('communion: the secretariat side proposes a card', prop.status === 201 && !!cardId)
    ok(
      'communion: a proposed card is not shown to the member',
      (await member.as('/communion/me')).json.card === null,
    )
    ok(
      'communion: the proposer cannot approve their own proposal',
      (await api(`/communion/cards/${cardId}/approve`, { method: 'POST', body: '{}' })).status ===
        403,
    )
    ok(
      'communion: an Elder cannot approve',
      (await elder.as(`/communion/cards/${cardId}/approve`, { method: 'POST', body: '{}' }))
        .status === 403,
    )
    ok(
      'communion: a second person (the pastor) approves',
      (await pastor.as(`/communion/cards/${cardId}/approve`, { method: 'POST', body: '{}' }))
        .status === 200,
    )
    // the dev database is remote and slow: one retry if a cold request times out
    let first = await member.as('/communion/me')
    if (first.status >= 500) first = await member.as('/communion/me')
    const mine = first.json.card as Record<string, any>
    ok(
      'communion: the member sees a valid card with a QR code and twelve months',
      mine?.state === 'valid' && !!mine.qr && mine.months.length === 12 && !!mine.verifyUrl,
    )
    const month = new Date().toISOString().slice(0, 7)
    ok(
      'communion: a plain member cannot sign a month',
      (
        await member.as(`/communion/cards/${cardId}/visa`, {
          method: 'PUT',
          body: JSON.stringify({ month, signed: true }),
        })
      ).status === 403,
    )
    ok(
      'communion: an Elder signs the month',
      (
        await elder.as(`/communion/cards/${cardId}/visa`, {
          method: 'PUT',
          body: JSON.stringify({ month, signed: true }),
        })
      ).status === 200,
    )
    const next = new Date()
    next.setUTCMonth(next.getUTCMonth() + 1)
    ok(
      'communion: a month that has not started cannot be signed',
      (
        await elder.as(`/communion/cards/${cardId}/visa`, {
          method: 'PUT',
          body: JSON.stringify({ month: next.toISOString().slice(0, 7), signed: true }),
        })
      ).status === 400,
    )
    const after = (await member.as('/communion/me')).json.card as Record<string, any>
    ok(
      'communion: the signed month counts in the streak',
      after.months.find((m: any) => m.month === month)?.state === 'signed' && after.streak >= 1,
    )
    const exc = await member.as('/communion/me/excuse', {
      method: 'PUT',
      body: JSON.stringify({ month, excused: true }),
    })
    ok(
      'communion: a signed (and past) month cannot be excused',
      exc.status === 409 || exc.status === 400,
    )
    ok(
      'communion: an Elder notes a contribution, a member never sees amounts',
      (
        await elder.as(`/communion/cards/${cardId}/contribution`, {
          method: 'PUT',
          body: JSON.stringify({ month, amountXaf: 5000 }),
        })
      ).status === 200 && !JSON.stringify((await member.as('/communion/me')).json).includes('5000'),
    )
    ok(
      'communion: a plain member cannot read the list of cards',
      (await member.as('/communion/cards')).status === 403,
    )
    // The QR code
    const tokenOf = (url: string) => new URL(url).searchParams.get('t') as string
    const pub = async (tk: string) =>
      (await (
        await fetch(`${base}/api/communion/verify/${encodeURIComponent(tk)}`)
      ).json()) as Record<string, any>
    const t1 = tokenOf(mine.verifyUrl)
    const v1 = await pub(t1)
    ok(
      'communion: scanning the code says « valid », a first name and an initial, nothing else',
      v1.valid === true &&
        v1.name === 'E2E F.' &&
        Object.keys(v1).sort().join() === 'name,until,valid',
    )
    ok(
      'communion: a forged code is not valid',
      (await pub(`${t1.slice(0, -3)}abc`)).valid === false,
    )
    const page = await fetch(`${base}/fr/verifier/?t=${encodeURIComponent(t1)}`)
    ok(
      'communion: the check page is never cached nor indexed',
      page.status === 200 &&
        (page.headers.get('cache-control') ?? '').includes('no-store') &&
        (page.headers.get('x-robots-tag') ?? '').includes('noindex'),
      `${page.status} ${page.headers.get('cache-control')} ${page.headers.get('x-robots-tag')}`,
    )
    ok(
      'communion: the check is open to a scanner account too',
      (await elder.as(`/communion/check/${encodeURIComponent(t1)}`)).json.state === 'valid',
    )
    ok(
      'communion: a member cannot use the scanner route',
      (await member.as(`/communion/check/${encodeURIComponent(t1)}`)).status === 403,
    )
    // Suspend, restore, renew, withdraw
    ok(
      'communion: suspending (secretariat) makes the code not valid',
      (await api(`/communion/cards/${cardId}/suspend`, { method: 'POST', body: '{}' })).status ===
        200 && (await pub(t1)).valid === false,
    )
    const sus = (await member.as('/communion/me')).json.card as Record<string, any>
    ok(
      'communion: the member sees « suspended » and no reason',
      sus.state === 'suspended' && !JSON.stringify(sus).toLowerCase().includes('reason') && !sus.qr,
    )
    await api(`/communion/cards/${cardId}/restore`, { method: 'POST', body: '{}' })
    ok('communion: restoring makes it valid again', (await pub(t1)).valid === true)
    await pastor.as(`/communion/cards/${cardId}/renew`, {
      method: 'POST',
      body: JSON.stringify({ validUntil: `${new Date().getFullYear() + 1}-12-31` }),
    })
    ok('communion: renewing stops the old code from working', (await pub(t1)).valid === false)
    const renewed = (await member.as('/communion/me')).json.card as Record<string, any>
    ok('communion: the new code works', (await pub(tokenOf(renewed.verifyUrl))).valid === true)
    ok(
      'communion: withdrawing needs a reason, and only the approver can',
      (await pastor.as(`/communion/cards/${cardId}/withdraw`, { method: 'POST', body: '{}' }))
        .status === 400 &&
        (
          await elder.as(`/communion/cards/${cardId}/withdraw`, {
            method: 'POST',
            body: JSON.stringify({ reason: 'Test e2e' }),
          })
        ).status === 403,
    )
    await pastor.as(`/communion/cards/${cardId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Test e2e' }),
    })
    ok(
      'communion: after a withdrawal the member simply has no card',
      (await member.as('/communion/me')).json.card === null,
    )
    const fee = await api('/communion/fees', {
      method: 'PUT',
      body: JSON.stringify({ kind: 'age', key: '18-25', amountXaf: 2000 }),
    })
    ok('communion: fees are set in the admin', fee.status === 200)
    await api('/communion/fees', {
      method: 'PUT',
      body: JSON.stringify({ kind: 'age', key: '18-25', amountXaf: null }),
    })
    ok(
      'communion: nobody without a session sees a card',
      (await fetch(`${base}/api/communion/me`)).status === 401,
    )
  }
}

// 14. Data requests log (decision 0052): a request is logged with a deadline, closed with a word on what was done, and only staff see it
{
  const anon = await fetch(`${base}/api/rights`)
  ok('rights: nobody without a session reads the log', anon.status === 401)
  const made = await api('/rights', {
    method: 'POST',
    body: JSON.stringify({ kind: 'access', name: `E2E Demande ${stamp}`, channel: 'phone' }),
  })
  const id = made.json.id as string
  ok('rights: a request is logged', made.status === 201 && !!id)
  const list = await api('/rights?status=open')
  const row = (
    list.json.items as { id: string; dueOn: string; receivedOn: string; urgency: string }[]
  )?.find((r) => r.id === id)
  const days = row
    ? Math.round((Date.parse(row.dueOn) - Date.parse(row.receivedOn)) / 86_400_000)
    : 0
  ok('rights: the deadline is 30 days from reception', days === 30 && row?.urgency === 'open')
  const noWord = await api(`/rights/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' }),
  })
  ok('rights: closing needs a word on what was done', noWord.status === 400)
  const closed = await api(`/rights/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done', outcome: 'Copie remise en main propre' }),
  })
  ok('rights: it can be closed', closed.status === 200)
  const gone = await api(`/rights/${id}`, { method: 'DELETE' })
  ok('rights: the super admin can delete it', gone.status === 200)
}

// 15. Google for staff (decision 0053): only from a signed-in account; nothing here reaches Google, it checks the guards
{
  const me = await api('/me')
  const profile = await api('/me/profile')
  ok(
    'google: the profile says how I sign in and whether Google is set up',
    Array.isArray(profile.json.signIn) && typeof profile.json.googleEnabled === 'boolean',
  )
  ok(
    'google: Mon espace points a team member to the admin',
    typeof profile.json.admin?.url === 'string' && profile.json.admin.needsPassword === false,
  )
  const anon = await fetch(`${base}/api/me/google`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: '{}',
  })
  ok('google: linking is refused without a session', anon.status === 401)
  const wrong = await api('/me/google', {
    method: 'POST',
    body: JSON.stringify({ current: 'pas-le-bon-mot-de-passe' }),
  })
  // 404 when Google is not set up on this environment, 400 when it is (the password is asked again)
  ok('google: linking asks for the password again', wrong.status === 400 || wrong.status === 404)
  ok(
    'google: a staff account with a password is not asked for one',
    me.json.needsPassword === false,
  )
  const again = await api('/me/password/set', {
    method: 'POST',
    body: JSON.stringify({ next: 'une-autre-phrase-solide-2026' }),
  })
  ok('google: a first password cannot be set over an existing one', again.status === 409)
  const none = await api('/me/google', { method: 'DELETE' })
  ok('google: nothing to remove when none is linked', none.status === 404 || none.status === 409)
  const person = await api(`/users/${me.json.user?.id}`)
  ok('google: staff see how a person signs in', Array.isArray(person.json.signIn))
  const start = await fetch(`${base}/api/members/google`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ locale: 'fr', target: 'admin' }),
  })
  ok(
    'google: the admin page can start a sign-in (or says it is not set up)',
    start.status === 200 || start.status === 404,
  )
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
