import { allow, can, checkPassword, consumeLink, createLink, findLink, writeAudit } from '@eec/auth'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../context.ts'
import { clientIp, fail, publicRoute, requirePermission } from '../guards.ts'

const create = z.object({
  email: z.email().max(200),
  roles: z
    .array(z.object({ roleKey: z.string().max(60), groupKey: z.string().max(60).optional() }))
    .max(10)
    .default([]),
})
const accept = z.object({ name: z.string().trim().min(1).max(120), password: z.string().max(200) })

export const invitationRoutes = new Hono<AppEnv>()
  // Staff invitation: the admin gets a single-use link to hand over (WhatsApp, in person). No email needed.
  .post(
    '/users/invitations',
    requirePermission('core:users-invite'),
    zValidator('json', create),
    async (c) => {
      const { email, roles } = c.req.valid('json')
      const actor = await c.var.deps.actor()
      if (!actor) return fail(c, 401, 'unauthenticated')
      if (roles.length && !can(actor.principal, 'core:roles-assign'))
        return fail(c, 403, 'forbidden')
      const db = await c.var.deps.db()
      const existing = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, email.toLowerCase()))
      if (existing.length) return fail(c, 409, 'email_taken')
      const keys = roles.map((r) => r.roleKey)
      if (keys.length) {
        const found = await db
          .select({ key: schema.roles.key })
          .from(schema.roles)
          .where(inArray(schema.roles.key, keys))
        if (found.length !== new Set(keys).size) return fail(c, 400, 'unknown_role')
      }
      const { token, expiresAt } = await createLink(db, {
        kind: 'invite',
        email,
        roles,
        createdBy: actor.userId,
      })
      await writeAudit(db, c.env.AUTH_SECRET, {
        actorId: actor.userId,
        action: 'invite.create',
        entityType: 'invitation',
        entityId: email.toLowerCase(),
        summaryFr: `Invitation créée pour ${email}`,
        summaryEn: `Invitation created for ${email}`,
        diff: { roles },
        ip: clientIp(c),
        userAgent: c.req.header('user-agent'),
      })
      return c.json({ url: `${c.env.APP_ORIGIN}/admin/invite/${token}`, expiresAt }, 201)
    },
  )

  .get('/invitations/:token', async (c) => {
    const db = await c.var.deps.db()
    if (!(await allow(db, `inv:${clientIp(c)}`, 20, 600))) return fail(c, 429, 'rate_limited')
    const link = await findLink(db, c.req.param('token'), 'invite')
    if (!link) return fail(c, 404, 'invalid_link')
    return c.json({ email: link.email, expiresAt: link.expiresAt })
  })

  // Redeem an invitation: creates the account, grants the roles, signs the person in. Public by design.
  .post(
    '/invitations/:token/accept',
    publicRoute('Redeems a single-use invitation link; rate-limited'),
    zValidator('json', accept),
    async (c) => {
      const db = await c.var.deps.db()
      if (!(await allow(db, `inv-accept:${clientIp(c)}`, 10, 600)))
        return fail(c, 429, 'rate_limited')
      const { name, password } = c.req.valid('json')
      const problem = checkPassword(password)
      if (problem) return fail(c, 400, `password_${problem}` as 'password_too_short')
      const link = await findLink(db, c.req.param('token'), 'invite')
      if (!link) return fail(c, 404, 'invalid_link')
      if (!(await consumeLink(db, link.id))) return fail(c, 404, 'invalid_link')

      const auth = await c.var.deps.auth()
      const created = await auth.api.signUpEmail({ body: { email: link.email, password, name } })
      const userId = created.user.id
      const wanted = (link.roles ?? []) as { roleKey: string; groupKey?: string }[]
      for (const w of wanted) {
        const [role] = await db
          .select({ id: schema.roles.id })
          .from(schema.roles)
          .where(eq(schema.roles.key, w.roleKey))
        const [group] = w.groupKey
          ? await db
              .select({ id: schema.groups.id })
              .from(schema.groups)
              .where(eq(schema.groups.key, w.groupKey))
          : [undefined]
        if (role)
          await db
            .insert(schema.userRoles)
            .values({
              userId,
              roleId: role.id,
              groupId: group?.id ?? null,
              grantedBy: link.createdBy,
            })
            .onConflictDoNothing()
      }
      await writeAudit(db, c.env.AUTH_SECRET, {
        actorId: userId,
        action: 'invite.accept',
        entityType: 'user',
        entityId: userId,
        summaryFr: `${name} a rejoint via une invitation`,
        summaryEn: `${name} joined through an invitation`,
        diff: { roles: wanted },
        ip: clientIp(c),
        userAgent: c.req.header('user-agent'),
      })
      // Re-issue the session so it gets the staff lifetime now that roles are granted.
      await db.delete(schema.session).where(eq(schema.session.userId, userId))
      const res = await auth.api.signInEmail({
        body: { email: link.email, password },
        asResponse: true,
      })
      const headers = new Headers({ 'content-type': 'application/json' })
      for (const cookie of res.headers.getSetCookie()) headers.append('set-cookie', cookie)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    },
  )

  // Staff password reset: an admin generates a single-use link (no email needed).
  .post('/users/:id/reset-link', requirePermission('core:users-reset-link'), async (c) => {
    const db = await c.var.deps.db()
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    const [u] = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, c.req.param('id')))
    if (!u) return fail(c, 404, 'not_found')
    const { token, expiresAt } = await createLink(db, {
      kind: 'reset',
      email: u.email,
      userId: u.id,
      createdBy: actor.userId,
    })
    await writeAudit(db, c.env.AUTH_SECRET, {
      actorId: actor.userId,
      action: 'reset-link.create',
      entityType: 'user',
      entityId: u.id,
      summaryFr: `Lien de réinitialisation généré pour ${u.email}`,
      summaryEn: `Reset link generated for ${u.email}`,
      ip: clientIp(c),
      userAgent: c.req.header('user-agent'),
    })
    return c.json({ url: `${c.env.APP_ORIGIN}/admin/reset/${token}`, expiresAt }, 201)
  })

  .post(
    '/reset/:token',
    publicRoute('Redeems a single-use reset link; rate-limited'),
    zValidator('json', z.object({ password: z.string().max(200) })),
    async (c) => {
      const db = await c.var.deps.db()
      if (!(await allow(db, `reset:${clientIp(c)}`, 10, 600))) return fail(c, 429, 'rate_limited')
      const { password } = c.req.valid('json')
      const problem = checkPassword(password)
      if (problem) return fail(c, 400, `password_${problem}` as 'password_too_short')
      const link = await findLink(db, c.req.param('token'), 'reset')
      if (!link?.userId) return fail(c, 404, 'invalid_link')
      if (!(await consumeLink(db, link.id))) return fail(c, 404, 'invalid_link')
      await db
        .update(schema.account)
        .set({ password: sql`eec_hash_password(${password})`, updatedAt: new Date() })
        .where(
          and(eq(schema.account.userId, link.userId), eq(schema.account.providerId, 'credential')),
        )
      await db.delete(schema.session).where(eq(schema.session.userId, link.userId))
      await writeAudit(db, c.env.AUTH_SECRET, {
        actorId: link.userId,
        action: 'password.reset',
        entityType: 'user',
        entityId: link.userId,
        summaryFr: 'Mot de passe réinitialisé par lien',
        summaryEn: 'Password reset through a link',
        ip: clientIp(c),
        userAgent: c.req.header('user-agent'),
      })
      return c.json({ ok: true })
    },
  )
