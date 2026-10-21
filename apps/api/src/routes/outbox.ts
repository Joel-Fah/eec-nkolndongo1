/**
 * The outbox (decision 0019): messages that would have been emailed, waiting for the secretariat to relay
 * them by hand (WhatsApp, phone) until a domain and Brevo exist. Marking one handled is audited.
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const { mailOutbox } = schema

export const outboxRoutes = new Hono<AppEnv>()
  .get(
    '/',
    requirePermission('core:system-outbox'),
    zValidator(
      'query',
      z.object({ status: z.enum(['pending', 'relayed', 'dismissed']).optional() }),
    ),
    async (c) => {
      const db = await c.var.deps.db()
      const { status } = c.req.valid('query')
      const rows = await db
        .select()
        .from(mailOutbox)
        .where(eq(mailOutbox.status, status ?? 'pending'))
        .orderBy(desc(mailOutbox.createdAt))
        .limit(200)
      return c.json({ messages: rows })
    },
  )

  .post(
    '/:id',
    requirePermission('core:system-outbox'),
    zValidator('json', z.object({ status: z.enum(['relayed', 'dismissed']) })),
    async (c) => {
      const id = c.req.param('id')
      const { status } = c.req.valid('json')
      const db = await c.var.deps.db()
      const actor = await c.var.deps.actor()
      const [row] = await db
        .update(mailOutbox)
        .set({ status, handledAt: new Date(), handledBy: actor?.userId ?? null })
        .where(and(eq(mailOutbox.id, id), eq(mailOutbox.status, 'pending')))
        .returning({ toEmail: mailOutbox.toEmail, template: mailOutbox.template })
      if (!row) return fail(c, 404, 'not_found')
      await audit(c, {
        action: `outbox.${status}`,
        entityType: 'outbox',
        entityId: id,
        summaryFr: `Message « ${row.template} » pour ${row.toEmail} ${status === 'relayed' ? 'transmis' : 'écarté'}`,
        summaryEn: `“${row.template}” message for ${row.toEmail} ${status === 'relayed' ? 'relayed' : 'dismissed'}`,
      })
      return c.json({ ok: true })
    },
  )
