/** Department pages (one per group), the people shown on them, and the « Où est ta place ? » quiz. */
import { id, timestamps, tz } from '@eec/db/columns'
import { groups, user } from '@eec/db/schema'
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

export const departmentPages = pgTable(
  'department_pages',
  {
    id: id(),
    /** 1:1 with the group; the address is the group's key. */
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    /** draft | published. Only published pages are public. */
    state: text('state').notNull().default('draft'),
    taglineFr: text('tagline_fr').notNull().default(''),
    taglineEn: text('tagline_en').notNull().default(''),
    bodyFr: jsonb('body_fr').notNull().default({ type: 'doc', content: [] }),
    bodyEn: jsonb('body_en').notNull().default({ type: 'doc', content: [] }),
    coverMediaId: uuid('cover_media_id'),
    meetingFr: text('meeting_fr').notNull().default(''),
    meetingEn: text('meeting_en').notNull().default(''),
    /** A WhatsApp link or a phone number; both optional. */
    contactWhatsapp: text('contact_whatsapp').notNull().default(''),
    contactPhone: text('contact_phone').notNull().default(''),
    /** Audience tags (jeunes, femmes, musique…), used by the filter and the quiz. */
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('department_pages_group_idx').on(t.groupId),
    index('department_pages_state_idx').on(t.state, t.sortOrder),
  ],
)

/** A person shown on a department page. Their name is public only with a recorded consent. */
export const departmentPeople = pgTable(
  'department_people',
  {
    id: id(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => departmentPages.id, { onDelete: 'cascade' }),
    /** A member of the site, or free text for someone without an account. */
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    roleFr: text('role_fr').notNull().default(''),
    roleEn: text('role_en').notNull().default(''),
    photoMediaId: uuid('photo_media_id'),
    publicConsent: boolean('public_consent').notNull().default(false),
    consentBy: uuid('consent_by').references(() => user.id, { onDelete: 'set null' }),
    consentAt: tz('consent_at'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('department_people_page_idx').on(t.pageId, t.sortOrder)],
)

/** The quiz: questions and the tags each answer points to. One row ("main"); nothing about visitors is stored. */
export const departmentQuiz = pgTable('department_quiz', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps(),
})
