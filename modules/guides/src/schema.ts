/** Guided paths (baptism, marriage, bereavement…): a guide and its ordered steps. */
import { id, timestamps } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const guides = pgTable(
  'guides',
  {
    id: id(),
    slug: text('slug').notNull(),
    /** draft | published. Only published guides are public, so unvalidated content never shows. */
    state: text('state').notNull().default('draft'),
    icon: text('icon').notNull().default('checklist'),
    sortOrder: integer('sort_order').notNull().default(0),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    introFr: text('intro_fr').notNull().default(''),
    introEn: text('intro_en').notNull().default(''),
    /** Who it is for, in a few words (« Parents », « Fiancés »…). */
    audienceFr: text('audience_fr').notNull().default(''),
    audienceEn: text('audience_en').notNull().default(''),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('guides_slug_idx').on(t.slug),
    index('guides_state_idx').on(t.state, t.sortOrder),
  ],
)

export const guideSteps = pgTable(
  'guide_steps',
  {
    id: id(),
    guideId: uuid('guide_id')
      .notNull()
      .references(() => guides.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    /** Documents to bring, one per line. */
    documentsFr: text('documents_fr').notNull().default(''),
    documentsEn: text('documents_en').notNull().default(''),
    durationFr: text('duration_fr').notNull().default(''),
    durationEn: text('duration_en').notNull().default(''),
    /** Who to contact for this step (free text: the secretariat, the pastor…). */
    contactFr: text('contact_fr').notNull().default(''),
    contactEn: text('contact_en').notNull().default(''),
  },
  (t) => [index('guide_steps_guide_idx').on(t.guideId, t.sortOrder)],
)
