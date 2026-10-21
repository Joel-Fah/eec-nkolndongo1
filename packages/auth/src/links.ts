/** Single-use access links: staff invitations (72 h) and password resets. Only the hash is stored. */
import { type Db, schema } from '@eec/db'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { randomToken, sha256 } from './crypto.ts'

export const INVITE_TTL_MS = 72 * 60 * 60 * 1000
export const RESET_TTL_MS = 2 * 60 * 60 * 1000

export type LinkRoles = { roleKey: string; groupKey?: string }[]

export async function createLink(
  db: Db,
  input: {
    kind: 'invite' | 'reset'
    email: string
    userId?: string | null
    roles?: LinkRoles
    createdBy: string | null
  },
) {
  const token = randomToken()
  const ttl = input.kind === 'invite' ? INVITE_TTL_MS : RESET_TTL_MS
  const expiresAt = new Date(Date.now() + ttl)
  await db.insert(schema.accessLinks).values({
    kind: input.kind,
    tokenHash: await sha256(token),
    userId: input.userId ?? null,
    email: input.email.toLowerCase(),
    roles: input.roles ?? null,
    expiresAt,
    createdBy: input.createdBy,
  })
  return { token, expiresAt }
}

/** Valid = exists, unused, not expired. Never reveals which of those failed. */
export async function findLink(db: Db, token: string, kind: 'invite' | 'reset') {
  const [row] = await db
    .select()
    .from(schema.accessLinks)
    .where(
      and(
        eq(schema.accessLinks.tokenHash, await sha256(token)),
        eq(schema.accessLinks.kind, kind),
        isNull(schema.accessLinks.usedAt),
        gt(schema.accessLinks.expiresAt, new Date()),
      ),
    )
  return row ?? null
}

/** Atomically burn the link. False if someone else used it first. */
export async function consumeLink(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .update(schema.accessLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.accessLinks.id, id), isNull(schema.accessLinks.usedAt)))
    .returning({ id: schema.accessLinks.id })
  return rows.length === 1
}
