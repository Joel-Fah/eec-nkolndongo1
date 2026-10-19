import { allow, checkPassword, writeAudit } from '@eec/auth'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../context.ts'
import { clientIp, fail, publicRoute } from '../guards.ts'

/** Bump when the privacy policy text changes: people are asked again. Later served from settings. */
export const POLICY_VERSION = '2026-10-brouillon'

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

export const memberRoutes = new Hono<AppEnv>().post(
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
    await db
      .insert(schema.consents)
      .values([
        { userId: user.id, kind: 'privacy', policyVersion: POLICY_VERSION },
        ...(body.acceptNews
          ? [{ userId: user.id, kind: 'news' as const, policyVersion: POLICY_VERSION }]
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
        policyVersion: POLICY_VERSION,
      },
      ip: clientIp(c),
      userAgent: c.req.header('user-agent'),
    })

    const headers = new Headers({ 'content-type': 'application/json' })
    for (const cookie of res.headers.getSetCookie()) headers.append('set-cookie', cookie)
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers })
  },
)
