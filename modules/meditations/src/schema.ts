/** The daily meditation programme: a plan (usually one year) and its days with their readings (references only). */
import type { Reading } from '@eec/core'
import { id, timestamps } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const meditationPlans = pgTable(
  'meditation_plans',
  {
    id: id(),
    slug: text('slug').notNull(),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    descriptionFr: text('description_fr').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    /** First and last day it covers (YYYY-MM-DD). The public site uses the published plan that covers today. */
    startsOn: text('starts_on').notNull(),
    endsOn: text('ends_on').notNull(),
    /** draft | published */
    state: text('state').notNull().default('draft'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('meditation_plans_slug_idx').on(t.slug),
    index('meditation_plans_dates_idx').on(t.startsOn, t.endsOn),
  ],
)

export const meditationDays = pgTable(
  'meditation_days',
  {
    id: id(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => meditationPlans.id, { onDelete: 'cascade' }),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    /** « 1er Dim. Avent », « Noël », « Dim. de la Réformation »: as the parish prints it (optional). */
    headlineFr: text('headline_fr').notNull().default(''),
    headlineEn: text('headline_en').notNull().default(''),
    /** Up to three readings (ordinary days have one, Sundays and feasts three), each with an optional label. */
    readings: jsonb('readings').$type<Reading[]>().notNull().default([]),
    /** The psalm as printed: « 89, 31-47 » or « 64 ». */
    psalm: text('psalm').notNull().default(''),
    /** A short reflection, if someone wants to add one (the printed programme has none). */
    reflectionFr: text('reflection_fr').notNull().default(''),
    reflectionEn: text('reflection_en').notNull().default(''),
    /** The verse of the day, picked from the day's readings: its reference and text, only in LSG 1910 / WEB (decision 0032). */
    verseRef: text('verse_ref').notNull().default(''),
    verseFr: text('verse_fr').notNull().default(''),
    verseEn: text('verse_en').notNull().default(''),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('meditation_days_plan_date_idx').on(t.planId, t.date)],
)

/**
 * The text of the Bible in a translation we may quote (decision 0032): Louis Segond 1910 for French (public domain), loaded once
 * by `pnpm bible:seed`. Read by staff to prefill the verse of the day; nothing here is public by itself.
 */
export const bibleVerses = pgTable(
  'bible_verses',
  {
    translation: text('translation').notNull(),
    book: text('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    text: text('text').notNull(),
  },
  (t) => [primaryKey({ columns: [t.translation, t.book, t.chapter, t.verse] })],
)
