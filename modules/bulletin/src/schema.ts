/** The weekly bulletin: one per Sunday, made of blocks (announcements, this Sunday, the week's agenda, meditations, free text). */
import { id, timestamps, tz } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const BLOCK_KINDS = ['announcements', 'sunday', 'agenda', 'meditations', 'text'] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]
/** One line of a block: a short heading and its text, in both languages (English optional). */
/** `key` ties a line to the record it came from (a Sunday's readings, an event, a day of meditation, a news item). */
export type BulletinItem = {
  titleFr: string
  titleEn: string
  textFr: string
  textEn: string
  key?: string
}
export type BulletinBlock = {
  id: string
  kind: BlockKind
  titleFr: string
  titleEn: string
  items: BulletinItem[]
}

export const bulletins = pgTable(
  'bulletins',
  {
    id: id(),
    /** The Sunday it is for (YYYY-MM-DD): also its address. */
    weekOf: text('week_of').notNull(),
    /** draft | published */
    state: text('state').notNull().default('draft'),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    blocks: jsonb('blocks').$type<BulletinBlock[]>().notNull().default([]),
    /** The paper bulletin as a PDF, if there is one: any https address (the site hosts no files here either). */
    pdfUrl: text('pdf_url').notNull().default(''),
    publishedAt: tz('published_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('bulletins_week_idx').on(t.weekOf),
    index('bulletins_state_idx').on(t.state, t.weekOf),
  ],
)
