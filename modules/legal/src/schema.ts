/** Versioned legal documents: the privacy policy, the legal notice and the credits. */
import { id, timestamps, tz } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const legalDocuments = pgTable(
  'legal_documents',
  {
    id: id(),
    /** privacy | mentions | credits */
    docKey: text('doc_key').notNull(),
    version: integer('version').notNull(),
    /** What people see and what consents record, e.g. « 2026-11-v2 ». */
    label: text('label').notNull(),
    /** draft | published. A published version is never edited: a new version is made instead. */
    state: text('state').notNull().default('draft'),
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    /** What changed, in plain words, shown to members when the policy changes. */
    summaryFr: text('summary_fr').notNull().default(''),
    summaryEn: text('summary_en').notNull().default(''),
    /** The purposes of processing changed: members are asked to accept again. */
    purposeChanged: boolean('purpose_changed').notNull().default(false),
    publishedAt: tz('published_at'),
    publishedBy: uuid('published_by').references(() => user.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('legal_documents_key_idx').on(t.docKey, t.version),
    index('legal_documents_state_idx').on(t.docKey, t.state),
  ],
)
