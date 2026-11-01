/** Roles, permissions, groups and who has what (decision 0005; Phase 02 §5.1). */
import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, timestamps, tz } from '../columns.ts'
import { user } from './auth.ts'

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  phone: text('phone'),
  locale: text('locale', { enum: ['fr', 'en'] })
    .notNull()
    .default('fr'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  status: text('status', { enum: ['active', 'invited', 'deactivated'] })
    .notNull()
    .default('active'),
  /**
   * Optional details a member chose to add (decision 0047). Only ever filled while the `profile` consent is active; withdrawing
   * the consent clears them all. Staff see an age band, never `birthDate`.
   */
  birthDate: date('birth_date', { mode: 'string' }),
  gender: text('gender', { enum: ['woman', 'man'] }),
  neighbourhood: text('neighbourhood'),
  city: text('city'),
  maritalStatus: text('marital_status', { enum: ['single', 'married', 'widowed', 'divorced'] }),
  profession: text('profession'),
  /** A private object (never a public media key); who may see it is `photoLevel`. */
  photoKey: text('photo_key'),
  /** Deprecated (decision 0047, amended): the team always sees an uploaded photo; kept so nothing is dropped. Use `photoAsAvatar`. */
  photoLevel: text('photo_level', { enum: ['private', 'staff'] })
    .notNull()
    .default('private'),
  /** The member's choice: their photo as the avatar in the navbar (true), or a generated avatar (false, the default). */
  photoAsAvatar: boolean('photo_as_avatar').notNull().default(false),
  photoUpdatedAt: tz('photo_updated_at'),
  /**
   * The carte de Sainte-Cène (decision 0050): what the member says about their baptism and confirmation (only with the `profile` consent),
   * and who confirmed it from the baptism register. Religious-belief data: never shown beyond the people who issue cards.
   */
  baptised: boolean('baptised'),
  confirmed: boolean('confirmed'),
  sacramentConfirmedBy: uuid('sacrament_confirmed_by'),
  sacramentConfirmedAt: tz('sacrament_confirmed_at'),
  lastSeenAt: tz('last_seen_at'),
  /** Set when the person asked to delete their account (30-day grace, then purged). */
  deletionRequestedAt: tz('deletion_requested_at'),
  ...timestamps(),
})

export const roles = pgTable('roles', {
  id: id(),
  key: text('key').notNull().unique(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isSystem: boolean('is_system').notNull().default(false),
  ...timestamps(),
})

/**
 * The ledger of system-role grants the seed has already offered (decision 0048): one row per (role, permission). The seed offers each
 * grant of a system role once, so a permission added to the code reaches every environment on its next seed, while a grant someone
 * removed on purpose in Rôles never comes back. Hand-added grants are never touched.
 */
export const rolePermissionOffers = pgTable(
  'role_permission_offers',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
    offeredAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
)

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  module: text('module').notNull(),
  labelFr: text('label_fr').notNull(),
  labelEn: text('label_en'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isDangerous: boolean('is_dangerous').notNull().default(false),
  /** Removed from a manifest: kept for history, never silently deleted. */
  deprecated: boolean('deprecated').notNull().default(false),
  createdAt: createdAt(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
)

export const groups = pgTable('groups', {
  id: id(),
  key: text('key').notNull().unique(),
  nameFr: text('name_fr').notNull(),
  nameEn: text('name_en'),
  kind: text('kind', { enum: ['department', 'committee', 'choir', 'other'] })
    .notNull()
    .default('department'),
  descriptionFr: text('description_fr'),
  descriptionEn: text('description_en'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps(),
})

/** A role granted to a user, optionally scoped to one group (null = global). */
export const userRoles = pgTable(
  'user_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => user.id, { onDelete: 'set null' }),
    grantedAt: tz('granted_at').notNull().defaultNow(),
    expiresAt: tz('expires_at'),
  },
  (t) => [
    index('user_roles_user_idx').on(t.userId),
    // one grant per (user, role, group); a global grant has group_id null
    uniqueIndex('user_roles_unique').on(
      t.userId,
      t.roleId,
      sql`coalesce(${t.groupId}, '00000000-0000-0000-0000-000000000000')`,
    ),
  ],
)

/** Membership is not permission: being in a group grants nothing by itself. */
export const groupMembers = pgTable(
  'group_members',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    titleFr: text('title_fr'),
    titleEn: text('title_en'),
    /** The member ticked « share my number with this group's leaders » (decision 0049); never pre-ticked. */
    sharePhone: boolean('share_phone').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
)

/**
 * A request to join a group (decision 0049). Kept apart from `group_members` so a person who is only waiting is never counted or listed
 * as a member by any existing query. Decided requests are erased 12 months after the decision, pending ones after 6 months.
 */
export const groupRequests = pgTable(
  'group_requests',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'approved', 'declined', 'withdrawn'] })
      .notNull()
      .default('pending'),
    /** What the member chose for their phone number if they are accepted. */
    sharePhone: boolean('share_phone').notNull().default(false),
    /** The leader's answer, shown to the member. */
    decisionMessage: text('decision_message'),
    requestedAt: tz('requested_at').notNull().defaultNow(),
    decidedBy: uuid('decided_by').references(() => user.id, { onDelete: 'set null' }),
    decidedAt: tz('decided_at'),
  },
  (t) => [
    index('group_requests_group_idx').on(t.groupId, t.status),
    // one waiting request per person and group
    uniqueIndex('group_requests_pending_idx')
      .on(t.userId, t.groupId)
      .where(sql`${t.status} = 'pending'`),
  ],
)
