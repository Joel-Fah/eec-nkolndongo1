import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { type Db, schema } from '@eec/db'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { and, eq } from 'drizzle-orm'
import { checkPassword, PASSWORD_MAX, PASSWORD_MIN } from './passwords.ts'
import { MEMBER_MS, sessionExpiry } from './sessions.ts'

export type GoogleConfig = { clientId: string; clientSecret: string }

/** Cookie set by POST /api/members/google before the redirect: the consent the person gave, and their language. */
export const GOOGLE_INTENT_COOKIE = 'eec_gc'
export type GoogleIntent = {
  l: 'fr' | 'en'
  privacy: boolean
  news: boolean
  v: string
  /** `admin` when the person started from the admin sign-in page: only existing staff may come out of it signed in. */
  a?: 'admin'
}

/** A Google link younger than this was made by the sign-in itself (an e-mail match), not earlier by the person (decision 0053). */
export const GOOGLE_FRESH_MS = 10_000

export const googleLinkIsFresh = (createdAt: Date, now = Date.now()) =>
  now - createdAt.getTime() < GOOGLE_FRESH_MS

export type GoogleVerdict = 'ok' | 'staff' | 'notstaff' | 'consent'

/**
 * What to do with someone who has just come back from Google (decision 0053). Staff may sign in with a link they made
 * themselves earlier (from their account, or as a member before being given a role): never with one the sign-in has just
 * created by matching the e-mail. The admin page lets only staff through. A new member needs the consent ticked first.
 */
export function googleVerdict(x: {
  staff: boolean
  freshLink: boolean
  knownMember: boolean
  fromAdmin: boolean
  consent: boolean
}): GoogleVerdict {
  if (x.staff) return x.freshLink ? 'staff' : 'ok'
  if (x.fromAdmin) return 'notstaff'
  if (x.knownMember) return 'ok'
  return x.consent ? 'ok' : 'consent'
}

export function readIntent(cookieHeader: string | null | undefined): GoogleIntent | null {
  const raw = cookieHeader
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOOGLE_INTENT_COOKIE}=`))
    ?.slice(GOOGLE_INTENT_COOKIE.length + 1)
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as GoogleIntent
    if (!v || (v.l !== 'fr' && v.l !== 'en')) return null
    return v.a === 'admin' ? v : { ...v, a: undefined }
  } catch {
    return null
  }
}

export type AuthDeps = {
  db: Db
  /** Run one SQL statement on the same connection (used for Postgres-side bcrypt). */
  query: <T extends Record<string, unknown>>(text: string, values: unknown[]) => Promise<T[]>
  secret: string
  /** The single origin, e.g. https://eec.workers.dev or http://localhost:8080 */
  origin: string
  /** Send a password-reset link somewhere: the outbox until a domain exists (decision 0019). */
  sendResetPassword?: (data: { email: string; url: string; userId: string }) => Promise<void>
  /** Absent = the Google buttons stay inactive. Members sign up and in with it; staff only with a link they added themselves (0053). */
  google?: GoogleConfig
  /** Policy version recorded with a Google sign-up's consent. */
  policyVersion?: string
  /** Where the admin lives, e.g. `/admin/` (the sign-in page is `login` under it). */
  adminBase?: string
}

const PASSWORD_PATHS = new Set([
  '/sign-up/email',
  '/reset-password',
  '/change-password',
  '/set-password',
])

export function createAuth({
  db,
  query,
  secret,
  origin,
  sendResetPassword,
  google,
  policyVersion = 'unversioned',
  adminBase = '/admin/',
}: AuthDeps) {
  const secure = origin.startsWith('https://')
  const adminLoginPath = `${adminBase}login`
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
      // Rate limiting needs the visitor's address: Cloudflare sets the first header, the local gateway the second.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
    user: {
      additionalFields: {
        givenName: { type: 'string', required: false, input: false },
        familyName: { type: 'string', required: false, input: false },
        locale: { type: 'string', required: false, input: false },
      },
    },
    // Anyone may link Google from their own signed-in account, even to another e-mail address (decision 0053).
    // A member who signed up with a password is also linked when Google returns the same verified address. Staff
    // are not: the after-hook below refuses a link that the sign-in itself has just made.
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google'], allowDifferentEmails: true },
    },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            // Default scopes only (openid, email, profile): name, email (verified by Google) and picture are
            // stored by Better Auth; we also keep the given/family name and language to prefill the profile.
            mapProfileToUser: (profile) => ({
              givenName: profile.given_name ?? null,
              familyName: profile.family_name ?? null,
              locale: profile.locale ?? null,
            }),
          },
        }
      : {},
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
      // After the Google callback: record the consent given before the redirect, or undo the sign-in.
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/callback/:id') return
        const created = ctx.context.newSession?.user
        if (!created) return
        const intent = readIntent(ctx.request?.headers.get('cookie'))
        const fromAdmin = intent?.a === 'admin'
        const back = (code: string): never => {
          throw ctx.redirect(
            fromAdmin
              ? `${origin}${adminLoginPath}?google=${code}`
              : `${origin}/${intent?.l ?? 'fr'}/mon-espace/?google=${code}`,
          )
        }
        /** Closes only the sign-in that has just happened; the account's other sessions are not touched. */
        const dropSession = async () => {
          const id = ctx.context.newSession?.session.id
          if (id) await db.delete(schema.session).where(eq(schema.session.id, id))
        }
        const dropLink = () =>
          db
            .delete(schema.account)
            .where(
              and(eq(schema.account.userId, created.id), eq(schema.account.providerId, 'google')),
            )
        ctx.setCookie(GOOGLE_INTENT_COOKIE, '', { maxAge: 0, path: '/api/auth' })

        const grants = await db
          .select({ k: schema.roles.key })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
          .where(eq(schema.userRoles.userId, created.id))
        const [link] = await db
          .select({ at: schema.account.createdAt })
          .from(schema.account)
          .where(
            and(eq(schema.account.userId, created.id), eq(schema.account.providerId, 'google')),
          )
        const [known] = await db
          .select({ id: schema.consents.id })
          .from(schema.consents)
          .where(and(eq(schema.consents.userId, created.id), eq(schema.consents.kind, 'privacy')))
        const freshLink = !!link && googleLinkIsFresh(link.at)
        /** An account only this visit created (never one that existed, even without a consent on record: an invited person, say). */
        const undoVisit = async () => {
          await dropSession()
          if (googleLinkIsFresh(created.createdAt))
            await db.delete(schema.user).where(eq(schema.user.id, created.id))
          else if (freshLink) await dropLink()
        }
        const verdict = googleVerdict({
          staff: grants.some((g) => g.k !== 'membre'),
          freshLink,
          knownMember: !!known,
          fromAdmin,
          consent: !!intent?.privacy,
        })
        if (verdict === 'ok' && known) return
        if (verdict === 'staff') {
          // Staff are not linked by an e-mail match: only the person, signed in, can add Google to their account.
          await dropSession()
          await dropLink()
          return back('staff')
        }
        if (verdict === 'notstaff') {
          // The admin page is for staff: anyone else is signed out again, and nothing this visit created is kept.
          await undoVisit()
          return back('notstaff')
        }
        if (verdict === 'consent') {
          // First time: only valid if the person ticked the privacy consent before leaving for Google.
          await undoVisit()
          return back('consent')
        }
        if (!intent?.privacy || grants.some((g) => g.k !== 'membre')) return
        await db.insert(schema.consents).values([
          { userId: created.id, kind: 'privacy', policyVersion: intent.v || policyVersion },
          ...(intent.news
            ? [
                {
                  userId: created.id,
                  kind: 'news' as const,
                  policyVersion: intent.v || policyVersion,
                },
              ]
            : []),
        ])
        await db.insert(schema.auditLog).values({
          actorId: created.id,
          action: 'member.signup',
          entityType: 'user',
          entityId: created.id,
          summaryFr: 'Nouvelle inscription de membre (Google)',
          summaryEn: 'New member sign-up (Google)',
          diff: {
            method: 'google',
            consents: ['privacy', ...(intent.news ? ['news'] : [])],
            policyVersion,
          },
        })
      }),
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
      account: {
        create: {
          // Every Google link is in the activity log (decision 0053); staff can see it on the person's page.
          after: async (a) => {
            if (a.providerId !== 'google') return
            await db.insert(schema.auditLog).values({
              actorId: a.userId,
              action: 'google.link',
              entityType: 'account',
              entityId: a.userId,
              summaryFr: 'Compte Google lié',
              summaryEn: 'Google account linked',
            })
          },
        },
      },
      user: {
        create: {
          // Every account starts as a member with a profile; staff roles are granted separately.
          after: async (user) => {
            const u = user as typeof user & {
              givenName?: string | null
              familyName?: string | null
              locale?: string | null
            }
            await db
              .insert(schema.profiles)
              .values({
                userId: user.id,
                status: 'active',
                firstName: u.givenName ?? '',
                lastName: u.familyName ?? '',
                locale: u.locale?.toLowerCase().startsWith('en') ? 'en' : 'fr',
              })
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
