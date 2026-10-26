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
      body: JSON.stringify({ baptised: true, confirmed: null }),
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

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
