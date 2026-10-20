/**
 * Activity log viewer: filters by person, action, kind of item and date; newest first, paged by cursor.
 * CSV export is for super admins only (Phase 02 §5.4) and is itself audited.
 */
import { type AppEnv, audit, fail, requirePermission } from '@eec/api-kit'
import { schema } from '@eec/db'
import { zValidator } from '@hono/zod-validator'
import { and, desc, eq, gte, like, lt, lte, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

const { auditLog, user } = schema

const query = z.object({
  actor: z.uuid().optional(),
  action: z.string().max(40).optional(),
  entity: z.string().max(40).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  before: z.iso.datetime({ offset: true }).optional(),
})

const filters = (q: z.infer<typeof query>) => {
  const w: SQL[] = []
  if (q.actor) w.push(eq(auditLog.actorId, q.actor))
  if (q.action) w.push(like(auditLog.action, `${q.action}%`))
  if (q.entity) w.push(eq(auditLog.entityType, q.entity))
  if (q.from) w.push(gte(auditLog.createdAt, new Date(`${q.from}T00:00:00Z`)))
  if (q.to) w.push(lte(auditLog.createdAt, new Date(`${q.to}T23:59:59Z`)))
  if (q.before) w.push(lt(auditLog.createdAt, new Date(q.before)))
  return w.length ? and(...w) : undefined
}

const select = {
  id: auditLog.id,
  createdAt: auditLog.createdAt,
  action: auditLog.action,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  summaryFr: auditLog.summaryFr,
  summaryEn: auditLog.summaryEn,
  diff: auditLog.diff,
  actorId: auditLog.actorId,
  actorName: user.name,
  actorEmail: user.email,
}

const PAGE = 50
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v)
  // Neutralise spreadsheet formulas (CSV injection) and quote every cell.
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replaceAll('"', '""')}"`
}

export const auditRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('core:audit-read'), zValidator('query', query), async (c) => {
    const db = await c.var.deps.db()
    const rows = await db
      .select(select)
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorId))
      .where(filters(c.req.valid('query')))
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE + 1)
    const more = rows.length > PAGE
    const page = rows.slice(0, PAGE)
    return c.json({ entries: page, next: more ? page.at(-1)?.createdAt : null })
  })

  .get(
    '/export.csv',
    requirePermission('core:audit-export'),
    zValidator('query', query),
    async (c) => {
      const actor = await c.var.deps.actor()
      if (!actor?.principal.isSuperAdmin) return fail(c, 403, 'forbidden')
      const db = await c.var.deps.db()
      const rows = await db
        .select(select)
        .from(auditLog)
        .leftJoin(user, eq(user.id, auditLog.actorId))
        .where(filters(c.req.valid('query')))
        .orderBy(desc(auditLog.createdAt))
        .limit(20_000)
      await audit(c, {
        action: 'audit.export',
        entityType: 'audit',
        summaryFr: `Journal d’activité exporté (${rows.length} lignes)`,
        summaryEn: `Activity log exported (${rows.length} rows)`,
        diff: c.req.valid('query'),
      })
      const head = [
        'date',
        'personne',
        'email',
        'action',
        'élément',
        'identifiant',
        'résumé',
        'détail',
      ]
      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.actorName,
          r.actorEmail,
          r.action,
          r.entityType,
          r.entityId,
          r.summaryFr,
          r.diff,
        ]
          .map(csvCell)
          .join(','),
      )
      // BOM so Excel opens accents correctly.
      return new Response(`﻿${[head.map(csvCell).join(','), ...lines].join('\r\n')}`, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="journal-activite-${new Date().toISOString().slice(0, 10)}.csv"`,
          'cache-control': 'no-store',
        },
      })
    },
  )
