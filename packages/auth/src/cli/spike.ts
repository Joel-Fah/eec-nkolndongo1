/** Auth spike: exercises the real handler against the dev database and prints timings. Dev only. */
import { assertBranch, connectDirect } from '@eec/db/node'
import { createAuth } from '../auth.ts'

assertBranch(['dev'])
const { db, close } = await connectDirect()
const query = async <T extends Record<string, unknown>>(text: string, values: unknown[]) =>
  (await db.$client.query(text, values)).rows as T[]
const origin = 'http://localhost:8080'
const auth = createAuth({ db, query, secret: process.env.AUTH_SECRET ?? '', origin })

const call = async (
  path: string,
  body?: unknown,
  cookie?: string,
  method = body ? 'POST' : 'GET',
) => {
  const t = performance.now()
  const res = await auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        origin,
        ...(cookie ? { cookie } : {}),
        'x-forwarded-for': '203.0.113.9',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  )
  const ms = Math.round(performance.now() - t)
  const text = await res.text()
  return { status: res.status, ms, text, setCookie: res.headers.getSetCookie() }
}
const email = `spike-${Date.now()}@example.test`
const pw = 'une-phrase-solide-2026'

const weak = await call('/sign-up/email', { email, password: 'password123', name: 'Test' })
console.log('weak common password →', weak.status, JSON.parse(weak.text).code)
const short = await call('/sign-up/email', { email, password: 'court', name: 'Test' })
console.log(
  'short password       →',
  short.status,
  JSON.parse(short.text).code ?? JSON.parse(short.text).message,
)
const up = await call('/sign-up/email', { email, password: pw, name: 'Test Spike' })
console.log('sign-up              →', up.status, `${up.ms}ms`)
const cookieAttrs = up.setCookie.map((c) =>
  c
    .split(';')
    .map((s) => s.trim())
    .filter((s, i) => (i === 0 ? false : true))
    .join('; '),
)
console.log(
  'cookie names/attrs   →',
  up.setCookie.map((c) => c.split('=')[0]).join(','),
  '|',
  cookieAttrs[0],
)
const cookie = up.setCookie.map((c) => c.split(';')[0]).join('; ')
const sess = await call('/get-session', undefined, cookie)
console.log(
  'get-session          →',
  sess.status,
  `${sess.ms}ms`,
  JSON.parse(sess.text)?.user?.email === email,
)
const bad = await call('/sign-in/email', { email, password: 'mauvais-mot-de-passe-1' })
console.log('wrong password       →', bad.status, JSON.parse(bad.text).message)
const ghost = await call('/sign-in/email', {
  email: 'nobody@example.test',
  password: 'mauvais-mot-de-passe-1',
})
console.log(
  'unknown account      →',
  ghost.status,
  JSON.parse(ghost.text).message,
  '(same message = no enumeration)',
)
const ok = await call('/sign-in/email', { email, password: pw })
console.log('sign-in              →', ok.status, `${ok.ms}ms`)
const timings: number[] = []
for (let i = 0; i < 3; i++) timings.push((await call('/sign-in/email', { email, password: pw })).ms)
console.log('sign-in repeat ms    →', timings.join(', '))
const statuses: number[] = []
for (let i = 0; i < 8; i++)
  statuses.push((await call('/sign-in/email', { email, password: 'x'.repeat(12) })).status)
console.log('rate limit (8 tries) →', statuses.join(','))
const out = await call('/sign-out', {}, cookie)
console.log('sign-out             →', out.status)
const after = await call('/get-session', undefined, cookie)
console.log('session after out    →', after.text.slice(0, 20))
const [row] = await query<{ n: number; role: string }>(
  'select count(*)::int n, string_agg(r.key, \',\') role from user_roles ur join roles r on r.id=ur.role_id join "user" u on u.id=ur.user_id where u.email=$1',
  [email],
)
console.log('profile+role created →', row?.role)
await query('delete from "user" where email=$1', [email])
await query("delete from rate_limit where key like '%203.0.113.9%'", [])
await close()
