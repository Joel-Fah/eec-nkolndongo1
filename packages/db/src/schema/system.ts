/** Platform tables: audit log, invitations/reset links, mail outbox, rate limits, feature flags. */
import { sql } from 'drizzle-orm'
import { bigint, boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, tz, updatedAt } from '../columns.ts'
import { user } from './auth.ts'

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => user.id, { onDelete: 'set null' }),
    /** create | update | delete | publish | login | logout | role.grant | role.revoke | … */
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    summaryFr: text('summary_fr').notNull(),
    summaryEn: text('summary_en'),
    /** Changed fields only. NEVER secrets, passwords or tokens. */
    diff: jsonb('diff'),
    /** Salted hash of the IP — never the raw address. */
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_actor_idx').on(t.actorId, t.createdAt),
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_created_idx').on(t.createdAt),
  ],
)

/** Single-use, expiring links: staff invitations and password resets (we store only the hash). */
export const accessLinks = pgTable(
  'access_links',
  {
    id: id(),
    kind: text('kind', { enum: ['invite', 'reset'] }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    /** Roles to grant when an invitation is accepted: [{ roleKey, groupKey? }]. */
    roles: jsonb('roles'),
    expiresAt: tz('expires_at').notNull(),
    usedAt: tz('used_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('access_links_expires_idx').on(t.expiresAt)],
)

/** Until a domain exists nothing is emailed: messages wait here for the secretariat to relay (decision 0019). */
export const mailOutbox = pgTable(
  'mail_outbox',
  {
    id: id(),
    toEmail: text('to_email').notNull(),
    template: text('template').notNull(),
    locale: text('locale', { enum: ['fr', 'en'] })
      .notNull()
      .default('fr'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    status: text('status', { enum: ['pending', 'relayed', 'dismissed'] })
      .notNull()
      .default('pending'),
    createdAt: createdAt(),
    handledAt: tz('handled_at'),
    handledBy: uuid('handled_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [index('outbox_status_idx').on(t.status, t.createdAt)],
)

/** Better Auth's database-backed rate limiter (sign-in, sign-up, reset…): counters per key and window. */
export const rateLimit = pgTable('rate_limit', {
  id: id(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

/** One row per toggleable module (module system, Phase 02 §6). Missing row = manifest default. */
export const settingsFlags = pgTable('settings_flags', {
  moduleId: text('module_id').primaryKey(),
  enabled: boolean('enabled').notNull(),
  updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
})

/** Daily retention job runs (what was removed), for transparency. */
export const retentionRuns = pgTable('retention_runs', {
  id: id(),
  ranAt: tz('ran_at').notNull().defaultNow(),
  result: jsonb('result').notNull(),
})

/** What a person agreed to, when, under which policy version (Loi n°2024/017: explicit, provable, withdrawable). */
export const consents = pgTable(
  'consents',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** privacy (required to hold an account) | news (optional, parish news later) */
    kind: text('kind', { enum: ['privacy', 'news'] }).notNull(),
    policyVersion: text('policy_version').notNull(),
    grantedAt: tz('granted_at').notNull().defaultNow(),
    withdrawnAt: tz('withdrawn_at'),
  },
  (t) => [index('consents_user_idx').on(t.userId, t.kind)],
)

/**
 * One counter per content area, bumped on every publish/save (decision 0021). It is part of the edge
 * cache key of public reads, so a change is visible within seconds without a global cache purge.
 */
export const contentVersions = pgTable('content_versions', {
  area: text('area').primaryKey(),
  version: integer('version').notNull().default(1),
  updatedAt: updatedAt(),
})

/**
 * Review comments on content waiting for validation (« À valider »): a content partner asks for a correction or leaves a
 * note on one item (a settings field, a schedule slot, a page text). `item_kind` + `item_ref` name the item; nothing here
 * is public. A comment is open until someone marks it resolved.
 */
export const contentReviews = pgTable(
  'content_reviews',
  {
    id: id(),
    itemKind: text('item_kind', { enum: ['settings', 'schedule', 'page_slot'] }).notNull(),
    itemRef: text('item_ref').notNull(),
    /** correction: asks for a change before validating. note: just a remark. */
    kind: text('kind', { enum: ['correction', 'note'] })
      .notNull()
      .default('correction'),
    body: text('body').notNull(),
    status: text('status', { enum: ['open', 'resolved'] })
      .notNull()
      .default('open'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    resolvedAt: tz('resolved_at'),
    resolvedBy: uuid('resolved_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (t) => [index('content_reviews_item_idx').on(t.itemKind, t.itemRef, t.status)],
)

/** The daily health check (« Santé »): one row per run, the checks as data. Kept 90 days. */
export const systemHealth = pgTable(
  'system_health',
  {
    id: id(),
    checkedAt: tz('checked_at').notNull().defaultNow(),
    /** The worst of the checks: ok | warn | fail. */
    status: text('status', { enum: ['ok', 'warn', 'fail'] }).notNull(),
    checks: jsonb('checks').notNull(),
  },
  (t) => [index('system_health_at_idx').on(t.checkedAt)],
)

/** Small facts the Worker cannot learn by itself (for example when the last backup finished). One row per key. */
export const systemMarks = pgTable('system_marks', {
  key: text('key').primaryKey(),
  at: tz('at').notNull().defaultNow(),
  note: text('note').notNull().default(''),
})
