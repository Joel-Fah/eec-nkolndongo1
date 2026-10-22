import type { AppEnv } from '@eec/api-kit'
import { clientIp, fail, publicRoute } from '@eec/api-kit'
import {
  allow,
  checkPassword,
  GOOGLE_INTENT_COOKIE,
  type GoogleIntent,
  writeAudit,
} from '@eec/auth'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { policyVersion } from '../policy.ts'

/** Bump when the privacy policy text changes: people are asked again. Later served from settings. */
export { DRAFT_POLICY as POLICY_VERSION } from '../policy.ts'

const signup = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  password: z.string().max(200),
  phone: z.string().trim().max(30).optional(),
  /** Required, never pre-ticked: the policy the person accepted. */
  acceptPrivacy: z.literal(true),
  /** Optional: parish news later. */
  acceptNews: z.boolean().default(false),
  /** Optional: groups the person is part of or interested in. */
  groupKeys: z.array(z.string().max(60)).max(20).default([]),
})

const google = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
  /** Ticked by the person on the page (never pre-ticked). Without it, only existing members can sign in. */
  acceptPrivacy: z.boolean().default(false),
  acceptNews: z.boolean().default(false),
})

export const memberRoutes = new Hono<AppEnv>()
  // Starts "Continue with Google". The consent is carried through the redirect by a short-lived cookie and
  // recorded (or refused) by the auth callback (packages/auth). Staff can never sign in this way.
  .post(
    '/google',
    publicRoute(
      'Starts Google sign-in for members: rate-limited, consent is checked in the callback',
    ),
    zValidator('json', google),
    async (c) => {
      if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)
        return fail(c, 404, 'not_configured')
      const db = await c.var.deps.db()
      if (!(await allow(db, `google:${clientIp(c)}`, 20, 600))) return fail(c, 429, 'rate_limited')
      const { locale, acceptPrivacy, acceptNews } = c.req.valid('json')
      const here = `/${locale}/${locale === 'fr' ? 'mon-espace' : 'my-space'}/`
      const auth = await c.var.deps.auth()
      const res = await auth.api.signInSocial({
        body: {
          provider: 'google',
          callbackURL: here,
          newUserCallbackURL: here,
          errorCallbackURL: `${here}?google=error`,
          disableRedirect: true,
        },
        asResponse: true,
      })
      if (!res.ok) return fail(c, 400, 'generic')
      const { url } = (await res.clone().json()) as { url?: string }
      if (!url) return fail(c, 400, 'generic')
      const intent: GoogleIntent = {
        l: locale,
        privacy: acceptPrivacy,
        news: acceptNews,
        v: await policyVersion(await c.var.deps.db()),
      }
      const headers = new Headers({ 'content-type': 'application/json' })
      for (const cookie of res.headers.getSetCookie()) headers.append('set-cookie', cookie)
      const secure = c.env.APP_ORIGIN.startsWith('https://') ? '; Secure' : ''
      headers.append(
        'set-cookie',
        `${GOOGLE_INTENT_COOKIE}=${encodeURIComponent(JSON.stringify(intent))}; Path=/api/auth; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
      )
      return new Response(JSON.stringify({ url }), { status: 200, headers })
    },
  )

  .post(
    '/signup',
    publicRoute('Public member sign-up: rate-limited, password policy, explicit versioned consent'),
    zValidator('json', signup),
    async (c) => {
      const db = await c.var.deps.db()
      if (!(await allow(db, `signup:${clientIp(c)}`, 5, 3600))) return fail(c, 429, 'rate_limited')
      const body = c.req.valid('json')
      const problem = checkPassword(body.password)
      if (problem) return fail(c, 400, `password_${problem}` as 'password_too_short')
      const email = body.email.toLowerCase()
      if (
        (
          await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.email, email))
        ).length
      )
        return fail(c, 409, 'email_taken')

      const auth = await c.var.deps.auth()
      const res = await auth.api.signUpEmail({
        body: { email, password: body.password, name: `${body.firstName} ${body.lastName}` },
        asResponse: true,
      })
      if (!res.ok) return fail(c, 400, 'generic')
      const { user } = (await res.clone().json()) as { user: { id: string } }

      await db
        .update(schema.profiles)
        .set({
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone || null,
          locale: c.req.header('accept-language')?.startsWith('en') ? 'en' : 'fr',
        })
        .where(eq(schema.profiles.userId, user.id))
      const currentVersion = await policyVersion(db)
      await db
        .insert(schema.consents)
        .values([
          { userId: user.id, kind: 'privacy', policyVersion: currentVersion },
          ...(body.acceptNews
            ? [{ userId: user.id, kind: 'news' as const, policyVersion: currentVersion }]
            : []),
        ])
      if (body.groupKeys.length) {
        const groups = await db
          .select({ id: schema.groups.id })
          .from(schema.groups)
          .where(inArray(schema.groups.key, body.groupKeys))
        if (groups.length)
          await db
            .insert(schema.groupMembers)
            .values(groups.map((g) => ({ userId: user.id, groupId: g.id })))
            .onConflictDoNothing()
      }
      await writeAudit(db, c.env.AUTH_SECRET, {
        actorId: user.id,
        action: 'member.signup',
        entityType: 'user',
        entityId: user.id,
        summaryFr: 'Nouvelle inscription de membre',
        summaryEn: 'New member sign-up',
        diff: {
          consents: ['privacy', ...(body.acceptNews ? ['news'] : [])],
          policyVersion: currentVersion,
        },
        ip: clientIp(c),
        userAgent: c.req.header('user-agent'),
      })

      const headers = new Headers({ 'content-type': 'application/json' })
      for (const cookie of res.headers.getSetCookie()) headers.append('set-cookie', cookie)
      return new Response(JSON.stringify({ ok: true }), { status: 201, headers })
    },
  )
