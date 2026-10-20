/**
 * Better Auth core tables (identity only). Authorization lives in rbac.ts.
 * Ids are UUIDs (`advanced.database.generateId: 'uuid'`). Passwords are hashed inside Postgres
 * (pgcrypto bcrypt) so the Worker's 10 ms CPU budget isn't spent on hashing (decision 0018).
 */
import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, tz, updatedAt } from '../columns.ts'

export const user = pgTable('user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** From Google sign-in (given_name, family_name, locale); copied to `profiles` on creation. */
  givenName: text('given_name'),
  familyName: text('family_name'),
  locale: text('locale'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  'session',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: tz('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId), index('session_expires_idx').on(t.expiresAt)],
)

export const account = pgTable(
  'account',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: tz('access_token_expires_at'),
    refreshTokenExpiresAt: tz('refresh_token_expires_at'),
    scope: text('scope'),
    /** bcrypt hash (`$2a$…`) written by the auth layer; never selected by app queries. */
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: tz('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)
