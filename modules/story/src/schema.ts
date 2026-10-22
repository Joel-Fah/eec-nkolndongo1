/** The words and people of the story pages: content slots, the history milestones, the council. */
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

export const pageSlots = pgTable(
  'page_slots',
  {
    id: id(),
    pageKey: text('page_key').notNull(),
    slotKey: text('slot_key').notNull(),
    valueFr: text('value_fr').notNull().default(''),
    valueEn: text('value_en').notNull().default(''),
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    /** draft | published. Only published slots replace the built-in text. */
    state: text('state').notNull().default('draft'),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('page_slots_key_idx').on(t.pageKey, t.slotKey)],
)

/** One point on « Gravir la colline ». `year` is free text (a year, a decade, « Aujourd'hui »). */
export const historyMilestones = pgTable(
  'history_milestones',
  {
    id: id(),
    year: text('year').notNull().default(''),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    textFr: text('text_fr').notNull().default(''),
    textEn: text('text_en').notNull().default(''),
    mediaId: uuid('media_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    state: text('state').notNull().default('draft'),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('history_milestones_idx').on(t.state, t.sortOrder)],
)

/** A person on the Pastors and Council page. The name is public only with a recorded consent. */
export const councilMembers = pgTable(
  'council_members',
  {
    id: id(),
    name: text('name').notNull(),
    roleKey: text('role_key').notNull(),
    /** What the card says under the name (« Responsable de la jeunesse »); the role group is the heading. */
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    photoMediaId: uuid('photo_media_id'),
    publicConsent: boolean('public_consent').notNull().default(false),
    consentBy: uuid('consent_by').references(() => user.id, { onDelete: 'set null' }),
    consentAt: tz('consent_at'),
    /** Optional term, as free text (« 2024 – 2028 »). */
    term: text('term').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('council_members_idx').on(t.roleKey, t.sortOrder)],
)
