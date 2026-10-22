/** Sermons (Prédications): a text page per sermon with links to where the video and audio live (decision 0034). */
import type { BibleRef } from '@eec/core'
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/** A series of sermons (« Les paraboles », « Carême 2027 »). */
export const sermonSeries = pgTable(
  'sermon_series',
  {
    id: id(),
    slug: text('slug').notNull(),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    descriptionFr: text('description_fr').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('sermon_series_slug_idx').on(t.slug)],
)

export type SermonLink = { label: string; url: string }

export const sermons = pgTable(
  'sermons',
  {
    id: id(),
    /** Optional owner group (the content kit's scope); sermons are parish-wide by default. */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    /** draft | published | archived. « Scheduled » is `published` with a future `publish_at`. */
    state: text('state').notNull().default('draft'),
    publishAt: tz('publish_at'),
    unpublishAt: tz('unpublish_at'),
    firstPublishedAt: tz('first_published_at'),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    summaryFr: text('summary_fr').notNull().default(''),
    summaryEn: text('summary_en').notNull().default(''),
    /** Notes of the sermon (rich text). */
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    /** The spoken text, if someone wrote it down (rich text, one language). */
    transcript: jsonb('transcript').notNull().default({ type: 'doc', content: [] }),
    /** Local date it was preached, YYYY-MM-DD. */
    preachedOn: text('preached_on'),
    seriesId: uuid('series_id').references(() => sermonSeries.id, { onDelete: 'set null' }),
    /** A name is public only when someone recorded that the person agreed (decision 0031). */
    preacherName: text('preacher_name').notNull().default(''),
    preacherConsent: boolean('preacher_consent').notNull().default(false),
    preacherConfirmedBy: uuid('preacher_confirmed_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    preacherConfirmedAt: tz('preacher_confirmed_at'),
    /** Passages (Louis Segond 1910 / World English Bible labels, decision 0032). */
    refs: jsonb('refs').$type<BibleRef[]>().notNull().default([]),
    /** The video on YouTube (11-character id), optional. */
    youtubeId: text('youtube_id').notNull().default(''),
    /** Any https links (audio on Drive, a PDF…), optional; the site never hosts or loads them (decision 0034). */
    links: jsonb('links').$type<SermonLink[]>().notNull().default([]),
    coverMediaId: uuid('cover_media_id'),
    /** The Sunday it belongs to (liturgy), YYYY-MM-DD, optional. */
    sundayDate: text('sunday_date'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('sermons_slug_idx').on(t.slug),
    index('sermons_list_idx').on(t.state, t.preachedOn),
    index('sermons_series_idx').on(t.seriesId),
  ],
)
