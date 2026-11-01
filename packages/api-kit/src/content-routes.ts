/**
 * The routes every content module shares (decision 0028, the content kit): publish / schedule, take off the site,
 * archive, delete, earlier versions (list, restore) and preview links. A module gives its table and a few small
 * functions; the lifecycle, audit trail, revisions, cache version bump and group-scoped rights are written once.
 * News and Events use it; the module keeps only what is specific (fields, public reads, its own PATCH).
 */
/* biome-ignore-all lint/suspicious/noExplicitAny: the factory is generic over a module's Drizzle table */

import { allow } from '@eec/auth'
import { cleanDoc, publishProblems, statusOf } from '@eec/core'
import type { Db } from '@eec/db'
import {
  contentRedirects,
  contentRevisions,
  groups,
  mediaFiles,
  mediaUsages,
  notifications,
  user,
} from '@eec/db/schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { audit } from './audit.ts'
import { bumpContentVersion } from './content.ts'
import type { AppEnv } from './context.ts'
import { fail, mayOn, requirePermissionAnywhere } from './guards.ts'
import { signPreview } from './preview.ts'

const REVISION_GAP_MS = 5 * 60 * 1000
const MAX_REVISIONS = 50

type Bi = { fr: string; en: string }
type Row = Record<string, any> & { id: string; state: string; groupId: string | null }

export type ContentConfig<R extends Row> = {
  entity: string
  area: string
  table: any
  perms: { read: string; edit: string; publish: string; delete: string }
  /** Words for the audit trail: « Actualité publiée »… */
  labels: { published: Bi; scheduled: Bi; unpublished: Bi; archived: Bi; deleted: Bi; restored: Bi }
  snapshotOf: (row: R) => Record<string, unknown>
  /** Columns to put back from a saved snapshot. */
  restoreSet: (snapshot: any) => Record<string, unknown>
  /** Title, text and dates checks before publishing (FR title required, etc.). */
  problems: (
    row: R,
    dates: { publishAt: Date | null; unpublishAt: Date | null },
  ) => ('title' | 'body' | 'dates')[]
  /** Library photos used by the row (cover and photos inside the text). */
  mediaIdsOf: (row: R) => { id: string; field: string }[]
  /** What a revision list shows. */
  revisionLabel: (snapshot: any) => { title: string; words: number }
}

const date = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))
  .nullable()
const publishSchema = z
  .object({ publishAt: date.optional(), unpublishAt: date.optional() })
  .strict()

/** The Monday of the week of today in Douala (the key notifications are grouped by). */
const thisWeek = () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

const lifecycleOf = (r: Row) => ({
  state: r.state as 'draft' | 'published' | 'archived',
  publishAt: (r.publishAt ?? null) as Date | null,
  unpublishAt: (r.unpublishAt ?? null) as Date | null,
})

export function contentRoutes<R extends Row>(cfg: ContentConfig<R>) {
  const { entity, area, table, perms } = cfg

  async function load(c: Parameters<typeof mayOn>[0], id: string, permission: string) {
    const db = await c.var.deps.db()
    const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1)
    if (!row) return { error: fail(c, 404, 'not_found') as Response }
    if (!(await mayOn(c, permission, (row as R).groupId)))
      return { error: fail(c, 403, 'forbidden') as Response }
    return { db, row: row as R }
  }

  async function saveRevision(
    db: Db,
    row: R,
    userId: string | null,
    reason: string,
    force: boolean,
  ) {
    const [last] = await db
      .select({ at: contentRevisions.createdAt })
      .from(contentRevisions)
      .where(and(eq(contentRevisions.entityType, entity), eq(contentRevisions.entityId, row.id)))
      .orderBy(desc(contentRevisions.createdAt))
      .limit(1)
    if (!force && last && Date.now() - last.at.getTime() < REVISION_GAP_MS) return
    await db.insert(contentRevisions).values({
      entityType: entity,
      entityId: row.id,
      snapshot: cfg.snapshotOf(row),
      reason,
      createdBy: userId,
    })
    const old = await db
      .select({ id: contentRevisions.id })
      .from(contentRevisions)
      .where(and(eq(contentRevisions.entityType, entity), eq(contentRevisions.entityId, row.id)))
      .orderBy(desc(contentRevisions.createdAt))
      .offset(MAX_REVISIONS)
    if (old.length)
      await db.delete(contentRevisions).where(
        inArray(
          contentRevisions.id,
          old.map((o) => o.id),
        ),
      )
  }

  /** Records which library photos the row uses, so one in use cannot be deleted from the library. */
  async function syncUsages(db: Db, row: R) {
    const used = cfg.mediaIdsOf(row)
    await db
      .delete(mediaUsages)
      .where(and(eq(mediaUsages.entityType, entity), eq(mediaUsages.entityId, row.id)))
    if (!used.length) return
    const existing = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(
        inArray(
          mediaFiles.id,
          used.map((u) => u.id),
        ),
      )
    const ok = new Set(existing.map((e) => e.id))
    const rows = used.filter((u) => ok.has(u.id))
    if (rows.length)
      await db.insert(mediaUsages).values(
        rows.map((u) => ({
          mediaId: u.id,
          entityType: entity,
          entityId: row.id,
          field: u.field,
        })),
      )
  }

  const router = new Hono<AppEnv>()
    // Someone who writes but may not publish (a group leader) asks the people who may (the secretariat). The request is an
    // in-app notification for each of them, closed when the item is published; asking again re-opens it.
    .get('/:id/request-publication', requirePermissionAnywhere(perms.edit), async (c) => {
      const r = await load(c, c.req.param('id'), perms.edit)
      if (r.error) return r.error
      const [asked] = await r.db
        .select({
          at: sql<string | null>`min(${notifications.createdAt})`,
          n: sql<number>`count(*)::int`,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.kind, 'publish_request'),
            eq(notifications.ref, `${entity}:${r.row.id}`),
            isNull(notifications.resolvedAt),
          ),
        )
      return c.json({ requested: (asked?.n ?? 0) > 0, at: asked?.at ?? null })
    })
    .post('/:id/request-publication', requirePermissionAnywhere(perms.edit), async (c) => {
      const r = await load(c, c.req.param('id'), perms.edit)
      if (r.error) return r.error
      const { db, row } = r
      const actor = await c.var.deps.actor()
      const me = actor?.userId as string
      if (!(await allow(db, `pubreq:${me}`, 20, 3600))) return fail(c, 429, 'rate_limited')
      if (row.state !== 'draft') return fail(c, 409, 'not_draft')
      const problems = cfg.problems(row, { publishAt: null, unpublishAt: null })
      if (problems.length) return c.json({ error: { code: 'not_ready', problems } }, 400)
      // Everyone who may publish this one: the parish-wide holders, those for its group, the super admins.
      const who = await db.execute<{ user_id: string }>(sql`
        select distinct ur.user_id from user_roles ur
          join roles ro on ro.id = ur.role_id
          join profiles pr on pr.user_id = ur.user_id and pr.status = 'active'
          left join role_permissions rp on rp.role_id = ur.role_id and rp.permission_key = ${perms.publish}
        where (ur.expires_at is null or ur.expires_at > now())
          and (rp.permission_key is not null or (ro.key = 'super-admin' and ur.group_id is null))
          and (ur.group_id is null or ur.group_id = ${row.groupId}::uuid)
          and ur.user_id <> ${me}::uuid`)
      if (!who.rows.length) return fail(c, 409, 'nobody')
      const [by] = await db.select({ name: user.name }).from(user).where(eq(user.id, me))
      const [grp] = row.groupId
        ? await db
            .select({ fr: groups.nameFr, en: groups.nameEn })
            .from(groups)
            .where(eq(groups.id, row.groupId))
        : []
      const params = {
        entity,
        title: cfg.revisionLabel(cfg.snapshotOf(row)).title,
        by: by?.name ?? '',
        groupFr: grp?.fr ?? null,
        groupEn: grp?.en ?? grp?.fr ?? null,
      }
      const week = thisWeek()
      await db
        .insert(notifications)
        .values(
          who.rows.map((w) => ({
            userId: w.user_id,
            kind: 'publish_request',
            ref: `${entity}:${row.id}`,
            params,
            href: `/m/${area}#${row.id}`,
            weekOf: week,
          })),
        )
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.kind, notifications.ref],
          set: { params, weekOf: week, readAt: null, resolvedAt: null, dismissedAt: null },
        })
      await audit(c, {
        action: 'update',
        entityType: entity,
        entityId: row.id,
        summaryFr: 'Publication demandée',
        summaryEn: 'Publication requested',
      })
      return c.json({ ok: true, asked: who.rows.length })
    })
    .post('/:id/publish', requirePermissionAnywhere(perms.publish), async (c) => {
      const r = await load(c, c.req.param('id'), perms.publish)
      if (r.error) return r.error
      const parsed = publishSchema.safeParse(await c.req.json().catch(() => ({})))
      if (!parsed.success) return fail(c, 400, 'invalid')
      const { db, row } = r
      const publishAt =
        parsed.data.publishAt === undefined ? (row.publishAt ?? null) : parsed.data.publishAt
      const unpublishAt =
        parsed.data.unpublishAt === undefined ? (row.unpublishAt ?? null) : parsed.data.unpublishAt
      const problems = cfg.problems(row, { publishAt, unpublishAt })
      if (problems.length) return c.json({ error: { code: 'not_ready', problems } }, 400)
      const actor = await c.var.deps.actor()
      const future = !!publishAt && publishAt > new Date()
      const [next] = await db
        .update(table)
        .set({
          state: 'published',
          publishAt,
          unpublishAt,
          firstPublishedAt: row.firstPublishedAt ?? (future ? null : new Date()),
          updatedBy: actor?.userId,
        })
        .where(eq(table.id, row.id))
        .returning()
      if (!next) return fail(c, 404, 'not_found')
      await saveRevision(db, next as R, actor?.userId ?? null, 'publish', true)
      await bumpContentVersion(db, area)
      const l = future ? cfg.labels.scheduled : cfg.labels.published
      await audit(c, {
        action: 'publish',
        entityType: entity,
        entityId: row.id,
        summaryFr: l.fr,
        summaryEn: l.en,
      })
      // Whoever asked for this to be published has their answer: the requests close for everyone who was asked.
      await db
        .update(notifications)
        .set({ resolvedAt: new Date() })
        .where(
          and(
            eq(notifications.kind, 'publish_request'),
            eq(notifications.ref, `${entity}:${row.id}`),
            isNull(notifications.resolvedAt),
          ),
        )
      return c.json({ status: statusOf(lifecycleOf(next as R)) })
    })
    .post('/:id/unpublish', requirePermissionAnywhere(perms.publish), async (c) => {
      const r = await load(c, c.req.param('id'), perms.publish)
      if (r.error) return r.error
      const actor = await c.var.deps.actor()
      await r.db
        .update(table)
        .set({ state: 'draft', updatedBy: actor?.userId })
        .where(eq(table.id, r.row.id))
      await bumpContentVersion(r.db, area)
      const l = cfg.labels.unpublished
      await audit(c, {
        action: 'update',
        entityType: entity,
        entityId: r.row.id,
        summaryFr: l.fr,
        summaryEn: l.en,
      })
      return c.json({ status: 'draft' })
    })
    .post('/:id/archive', requirePermissionAnywhere(perms.publish), async (c) => {
      const r = await load(c, c.req.param('id'), perms.publish)
      if (r.error) return r.error
      const actor = await c.var.deps.actor()
      await r.db
        .update(table)
        .set({ state: 'archived', updatedBy: actor?.userId })
        .where(eq(table.id, r.row.id))
      await bumpContentVersion(r.db, area)
      const l = cfg.labels.archived
      await audit(c, {
        action: 'update',
        entityType: entity,
        entityId: r.row.id,
        summaryFr: l.fr,
        summaryEn: l.en,
      })
      return c.json({ status: 'archived' })
    })
    .delete('/:id', requirePermissionAnywhere(perms.delete), async (c) => {
      const r = await load(c, c.req.param('id'), perms.delete)
      if (r.error) return r.error
      const id = r.row.id
      await r.db
        .delete(mediaUsages)
        .where(and(eq(mediaUsages.entityType, entity), eq(mediaUsages.entityId, id)))
      await r.db
        .delete(contentRevisions)
        .where(and(eq(contentRevisions.entityType, entity), eq(contentRevisions.entityId, id)))
      await r.db
        .delete(contentRedirects)
        .where(and(eq(contentRedirects.entityType, entity), eq(contentRedirects.entityId, id)))
      await r.db
        .delete(notifications)
        .where(
          and(eq(notifications.kind, 'publish_request'), eq(notifications.ref, `${entity}:${id}`)),
        )
      await r.db.delete(table).where(eq(table.id, id))
      await bumpContentVersion(r.db, area)
      const l = cfg.labels.deleted
      await audit(c, {
        action: 'delete',
        entityType: entity,
        entityId: id,
        summaryFr: l.fr,
        summaryEn: l.en,
      })
      return c.json({ ok: true })
    })
    .get('/:id/revisions', requirePermissionAnywhere(perms.read), async (c) => {
      const r = await load(c, c.req.param('id'), perms.read)
      if (r.error) return r.error
      const rows = await r.db
        .select({
          id: contentRevisions.id,
          reason: contentRevisions.reason,
          createdAt: contentRevisions.createdAt,
          snapshot: contentRevisions.snapshot,
        })
        .from(contentRevisions)
        .where(
          and(eq(contentRevisions.entityType, entity), eq(contentRevisions.entityId, r.row.id)),
        )
        .orderBy(desc(contentRevisions.createdAt))
        .limit(MAX_REVISIONS)
      return c.json({
        items: rows.map((x) => ({
          id: x.id,
          reason: x.reason,
          createdAt: x.createdAt,
          ...cfg.revisionLabel(x.snapshot),
        })),
      })
    })
    .post('/:id/revisions/:rid/restore', requirePermissionAnywhere(perms.edit), async (c) => {
      const r = await load(c, c.req.param('id'), perms.edit)
      if (r.error) return r.error
      const [rev] = await r.db
        .select()
        .from(contentRevisions)
        .where(
          and(eq(contentRevisions.id, c.req.param('rid')), eq(contentRevisions.entityId, r.row.id)),
        )
        .limit(1)
      if (!rev) return fail(c, 404, 'not_found')
      const actor = await c.var.deps.actor()
      // Keep what is there now as a version first, so a restore can itself be undone.
      await saveRevision(r.db, r.row, actor?.userId ?? null, 'before-restore', true)
      const [next] = await r.db
        .update(table)
        .set({ ...cfg.restoreSet(rev.snapshot), updatedBy: actor?.userId })
        .where(eq(table.id, r.row.id))
        .returning()
      if (next) {
        await syncUsages(r.db, next as R)
        if ((next as R).state === 'published') await bumpContentVersion(r.db, area)
      }
      const l = cfg.labels.restored
      await audit(c, {
        action: 'update',
        entityType: entity,
        entityId: r.row.id,
        summaryFr: l.fr,
        summaryEn: l.en,
      })
      return c.json({ ok: true })
    })
    .post('/:id/preview', requirePermissionAnywhere(perms.read), async (c) => {
      const r = await load(c, c.req.param('id'), perms.read)
      if (r.error) return r.error
      return c.json({
        token: await signPreview(c.env.AUTH_SECRET, entity, r.row.id),
        expiresInDays: 3,
      })
    })

  return { router, load, saveRevision, syncUsages, cleanDoc, publishProblems }
}
