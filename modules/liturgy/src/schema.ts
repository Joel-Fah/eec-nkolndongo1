/** Sundays (« Ce dimanche »), the liturgical year's texts, and the verse of the day. */
import type { BibleRef } from '@eec/core'
import { id, timestamps, tz } from '@eec/db/columns'
import { user } from '@eec/db/schema'
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const liturgySundays = pgTable(
  'liturgy_sundays',
  {
    id: id(),
    /** Local date of the Sunday, YYYY-MM-DD. */
    date: text('date').notNull(),
    nameFr: text('name_fr').notNull().default(''),
    nameEn: text('name_en').notNull().default(''),
    themeFr: text('theme_fr').notNull().default(''),
    themeEn: text('theme_en').notNull().default(''),
    readings: jsonb('readings').$type<BibleRef[]>().notNull().default([]),
    /** Display names. Public only when someone recorded that the person agreed (names_consent). */
    preacherName: text('preacher_name').notNull().default(''),
    liturgistName: text('liturgist_name').notNull().default(''),
    namesConsent: boolean('names_consent').notNull().default(false),
    namesConfirmedBy: uuid('names_confirmed_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    namesConfirmedAt: tz('names_confirmed_at'),
    /** A Holy Supper Sunday (Sainte Cène), whatever the season. */
    holySupper: boolean('holy_supper').notNull().default(false),
    hymns: text('hymns').notNull().default(''),
    notesFr: text('notes_fr').notNull().default(''),
    notesEn: text('notes_en').notNull().default(''),
    /** draft | published */
    state: text('state').notNull().default('draft'),
    publishedAt: tz('published_at'),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('liturgy_sundays_date_idx').on(t.date)],
)

/** What each season means and what happens at the parish. Approved before it shows on the site. */
export const liturgySeasons = pgTable(
  'liturgy_seasons',
  {
    id: id(),
    season: text('season').notNull(),
    meaningFr: text('meaning_fr').notNull().default(''),
    meaningEn: text('meaning_en').notNull().default(''),
    parishFr: text('parish_fr').notNull().default(''),
    parishEn: text('parish_en').notNull().default(''),
    validated: boolean('validated').notNull().default(false),
    validatedBy: uuid('validated_by').references(() => user.id, { onDelete: 'set null' }),
    validatedAt: tz('validated_at'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('liturgy_seasons_season_idx').on(t.season)],
)

/** A verse: a reference, and its text only in a translation we may quote (decision 0032: LSG 1910, WEB). */
export const liturgyVerses = pgTable(
  'liturgy_verses',
  {
    id: id(),
    ref: jsonb('ref').$type<BibleRef>().notNull(),
    textFr: text('text_fr').notNull().default(''),
    textEn: text('text_en').notNull().default(''),
    translationFr: text('translation_fr').notNull().default('LSG'),
    translationEn: text('translation_en').notNull().default('WEB'),
    /** A verse for one day (local date), or for a season, or neither (the general pool). */
    onDate: text('on_date'),
    season: text('season'),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('liturgy_verses_date_idx').on(t.onDate)],
)
