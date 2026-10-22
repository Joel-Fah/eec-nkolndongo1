/** Shared by every content module (news, events, guides…): saved versions, and old addresses that now redirect. */
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id } from '../columns.ts'
import { user } from './auth.ts'

/** A snapshot of an item at a moment (every publish, and at most one every few minutes while writing). */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: id(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** The editable fields as they were. Never anything secret. */
    snapshot: jsonb('snapshot').notNull(),
    /** « Publié », « Enregistré automatiquement »… */
    reason: text('reason').notNull().default('save'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('content_revisions_entity_idx').on(t.entityType, t.entityId, t.createdAt)],
)

/** When an address changes (new title, new slug) the old one keeps working: the public site redirects to the new. */
export const contentRedirects = pgTable(
  'content_redirects',
  {
    id: id(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    fromPath: text('from_path').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('content_redirects_from_idx').on(t.entityType, t.fromPath)],
)
