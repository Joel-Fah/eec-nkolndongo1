import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { type Db, schema } from '@eec/db'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { and, eq } from 'drizzle-orm'
import { checkPassword, PASSWORD_MAX, PASSWORD_MIN } from './passwords.ts'
import { MEMBER_MS, sessionExpiry } from './sessions.ts'

export type AuthDeps = {
  db: Db
  /** Run one SQL statement on the same connection (used for Postgres-side bcrypt). */
  query: <T extends Record<string, unknown>>(text: string, values: unknown[]) => Promise<T[]>
  secret: string
  /** The single origin, e.g. https://eec.workers.dev or http://localhost:8080 */
  origin: string
  /** Send a password-reset link somewhere: the outbox until a domain exists (decision 0019). */
  sendResetPassword?: (data: { email: string; url: string; userId: string }) => Promise<void>
}

const PASSWORD_PATHS = new Set([
  '/sign-up/email',
  '/reset-password',
  '/change-password',
  '/set-password',
])

export function createAuth({ db, query, secret, origin, sendResetPassword }: AuthDeps) {
  const secure = origin.startsWith('https://')
  return betterAuth({
    appName: 'EEC Nkolndongo 1',
    baseURL: origin,
    basePath: '/api/auth',
    secret,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    advanced: {
      // First-party cookie on our single origin (decision 0017): HttpOnly, Secure in production, Lax.
      cookiePrefix: 'eec',
      useSecureCookies: secure,
      defaultCookieAttributes: { httpOnly: true, secure, sameSite: 'lax', path: '/' },
      database: { generateId: 'uuid' },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      requireEmailVerification: false,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      // bcrypt runs inside Postgres (pgcrypto): the Worker's 10 ms CPU budget is never spent hashing.
      password: {
        hash: async (password) => {
          const [row] = await query<{ h: string }>('select eec_hash_password($1) as h', [password])
          return row?.h ?? ''
        },
        verify: async ({ hash, password }) => {
          const [row] = await query<{ ok: boolean }>('select eec_verify_password($1, $2) as ok', [
            password,
            hash,
          ])
          return row?.ok === true
        },
      },
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassword?.({ email: user.email, url, userId: user.id })
      },
    },
    session: {
      // Members stay signed in 30 days. Staff sessions are shortened in the create hook below.
      expiresIn: Math.floor(MEMBER_MS / 1000),
      // We slide sessions ourselves (sessions.ts): staff 12 h idle / 7 days max, members 30 days.
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 3600, max: 5 },
        '/request-password-reset': { window: 3600, max: 5 },
        '/reset-password': { window: 3600, max: 10 },
        '/change-password': { window: 3600, max: 10 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!PASSWORD_PATHS.has(ctx.path)) return
        const body = (ctx.body ?? {}) as { password?: string; newPassword?: string }
        const password = body.password ?? body.newPassword
        if (typeof password !== 'string') return
        const problem = checkPassword(password)
        if (problem)
          throw new APIError('BAD_REQUEST', {
            message: problem,
            code: `PASSWORD_${problem.toUpperCase()}`,
          })
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Every account starts as a member with a profile; staff roles are granted separately.
          after: async (user) => {
            await db
              .insert(schema.profiles)
              .values({ userId: user.id, status: 'active' })
              .onConflictDoNothing()
            const [member] = await db
              .select({ id: schema.roles.id })
              .from(schema.roles)
              .where(eq(schema.roles.key, 'membre'))
            if (member)
              await db
                .insert(schema.userRoles)
                .values({ userId: user.id, roleId: member.id })
                .onConflictDoNothing()
          },
        },
      },
      session: {
        create: {
          // Staff (any right beyond "member"): 12 h idle, 7 days at most. Members: 30 days.
          before: async (session) => {
            const staff = await db
              .select({ k: schema.roles.key })
              .from(schema.userRoles)
              .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
              .where(and(eq(schema.userRoles.userId, session.userId)))
            const isStaff = staff.some((r) => r.k !== 'membre')
            return {
              data: {
                ...session,
                expiresAt: sessionExpiry({ staff: isStaff, createdAt: new Date() }),
              },
            }
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
