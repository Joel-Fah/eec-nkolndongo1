import type { AppEnv, Deps } from '@eec/api-kit'
import { dbUrl } from '@eec/api-kit'
import { createAuth, isStaff, loadPrincipal, slideSession } from '@eec/auth'
import { connect, type Db, schema } from '@eec/db'
import type { MiddlewareHandler } from 'hono'
import { POLICY_VERSION } from './routes/members.ts'

/** Opens one database connection per request, on first use, and closes it when the response is done. */
export const withDeps: MiddlewareHandler<AppEnv> = async (c, next) => {
  let conn: Awaited<ReturnType<typeof connect>> | undefined
  let auth: ReturnType<typeof createAuth> | undefined
  let actor: Awaited<ReturnType<Deps['actor']>> | undefined
  let actorLoaded = false

  const db = async () => {
    conn ??= await connect(dbUrl(c.env))
    return conn.db
  }
  const getAuth = async () => {
    if (auth) return auth
    const d = await db()
    auth = createAuth({
      db: d,
      query: async (text, values) => (await d.$client.query(text, values as unknown[])).rows,
      secret: c.env.AUTH_SECRET,
      origin: c.env.APP_ORIGIN,
      google:
        c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET
          ? { clientId: c.env.GOOGLE_CLIENT_ID, clientSecret: c.env.GOOGLE_CLIENT_SECRET }
          : undefined,
      policyVersion: POLICY_VERSION,
      // No domain, no email (decision 0019): reset requests wait in the outbox for the secretariat.
      sendResetPassword: async ({ email, url }) => {
        await d
          .insert(schema.mailOutbox)
          .values({ toEmail: email, template: 'password-reset', payload: { url } })
      },
    })
    return auth
  }
  const getActor = async () => {
    if (actorLoaded) return actor ?? null
    actorLoaded = true
    const a = await getAuth()
    const session = await a.api.getSession({ headers: c.req.raw.headers })
    if (!session) return null
    const principal = await loadPrincipal(await db(), session.user.id)
    actor = principal ? { userId: session.user.id, principal } : undefined
    // Rolling session lifetime (staff 12 h idle / 7 days max; members 30 days).
    if (principal)
      await slideSession(await db(), session.session, isStaff(principal)).catch(() => {})
    return actor ?? null
  }

  // For work that outlives the response (stale-while-revalidate): the request's connection is closed by then.
  const withDb = async <R>(fn: (db: Db) => Promise<R>) => {
    const own = await connect(dbUrl(c.env))
    try {
      return await fn(own.db)
    } finally {
      await own.close().catch(() => {})
    }
  }

  c.set('deps', {
    db,
    withDb,
    timeoutMs: c.env.HYPERDRIVE ? 1500 : 8000,
    auth: getAuth,
    actor: getActor,
  })
  try {
    await next()
  } finally {
    if (conn) await conn.close().catch(() => {})
  }
}
