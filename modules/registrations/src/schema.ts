/**
 * Registrations (Inscriptions, decision 0035): a form per activity, the people who signed up, the children recorded by a
 * parent (first name + age band only), and anonymised totals that outlive the personal data.
 */
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

/** The extra questions a form may ask. There is deliberately no « sensitive » kind (health, origin, religion, finances). */
export const FIELD_KINDS = ['group', 'text', 'choice', 'multi', 'yesno'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]
export type FormField = {
  id: string
  kind: FieldKind
  labelFr: string
  labelEn: string
  required: boolean
  /** The choices of a `choice` / `multi` field. */
  options: { fr: string; en: string }[]
}

export const registrationForms = pgTable(
  'registration_forms',
  {
    id: id(),
    /** Group scope: a group leader sees the forms of their own group only. */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    slug: text('slug').notNull(),
    /** draft | published. Whether it is open now depends on the dates. */
    state: text('state').notNull().default('draft'),
    titleFr: text('title_fr').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    /** A few lines on what the registration is for (plain text). */
    introFr: text('intro_fr').notNull().default(''),
    introEn: text('intro_en').notNull().default(''),
    /** The event it belongs to (its slug in the agenda), optional: the form also stands on its own. */
    eventSlug: text('event_slug'),
    /** The day of the activity (YYYY-MM-DD): the retention clock starts here. */
    eventDate: text('event_date').notNull(),
    opensAt: tz('opens_at'),
    closesAt: tz('closes_at'),
    /** Places (people, children included); null = no limit. */
    capacity: integer('capacity'),
    waitlist: boolean('waitlist').notNull().default(true),
    /** open = anyone; members = signed-in members only. */
    audience: text('audience').notNull().default('open'),
    /** An activity for minors: the registrant is the parent or guardian, children are listed by first name and age band. */
    forMinors: boolean('for_minors').notNull().default(false),
    askWhatsapp: boolean('ask_whatsapp').notNull().default(true),
    fields: jsonb('fields').$type<FormField[]>().notNull().default([]),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('registration_forms_slug_idx').on(t.slug),
    index('registration_forms_state_idx').on(t.state, t.eventDate),
    index('registration_forms_event_idx').on(t.eventSlug),
  ],
)

export const registrations = pgTable(
  'registrations',
  {
    id: id(),
    formId: uuid('form_id')
      .notNull()
      .references(() => registrationForms.id, { onDelete: 'cascade' }),
    /** The short code shown on the confirmation page (no ambiguous characters). */
    code: text('code').notNull(),
    /** confirmed | waitlist | cancelled */
    status: text('status').notNull().default('confirmed'),
    name: text('name').notNull(),
    /** E.164, always with the country code (the form accepts it without). */
    phone: text('phone').notNull(),
    whatsapp: text('whatsapp').notNull().default(''),
    email: text('email').notNull().default(''),
    /** People in all, the registrant included. */
    partySize: integer('party_size').notNull().default(1),
    answers: jsonb('answers')
      .$type<Record<string, string | string[] | boolean>>()
      .notNull()
      .default({}),
    guardianConfirmed: boolean('guardian_confirmed').notNull().default(false),
    /** The unticked box, ticked: when, and under which privacy-policy version. */
    consentAt: tz('consent_at').notNull(),
    policyVersion: text('policy_version').notNull(),
    /** Set only when the person registered while signed in. */
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    /** Staff entered it by hand (phone call, paper list). */
    addedBy: uuid('added_by').references(() => user.id, { onDelete: 'set null' }),
    checkedInAt: tz('checked_in_at'),
    /** A place opened and this person moved up from the waitlist: the secretariat has to tell them. */
    promotedAt: tz('promoted_at'),
    notifiedAt: tz('notified_at'),
    cancelledAt: tz('cancelled_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('registrations_code_idx').on(t.formId, t.code),
    index('registrations_form_idx').on(t.formId, t.status, t.createdAt),
  ],
)

/** Children, recorded by the parent or guardian: a first name and an age band, nothing else. */
export const registrationPeople = pgTable(
  'registration_people',
  {
    id: id(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => registrations.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    ageBand: text('age_band').notNull(),
    checkedInAt: tz('checked_in_at'),
  },
  (t) => [index('registration_people_reg_idx').on(t.registrationId)],
)

/**
 * What survives when the personal data is deleted: totals per form, with no name or contact. Written by the retention job
 * just before it deletes (and kept even if the form is deleted, hence no foreign key).
 */
export const registrationCounts = pgTable('registration_counts', {
  formId: uuid('form_id').primaryKey(),
  titleFr: text('title_fr').notNull().default(''),
  eventDate: text('event_date').notNull(),
  registered: integer('registered').notNull().default(0),
  waitlisted: integer('waitlisted').notNull().default(0),
  cancelled: integer('cancelled').notNull().default(0),
  present: integer('present').notNull().default(0),
  recordedAt: tz('recorded_at').notNull(),
})
