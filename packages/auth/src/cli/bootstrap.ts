/**
 * `pnpm admin:bootstrap` — creates the first super admin WITHOUT any password in the terminal:
 * it prints a single-use invitation link; the person opens it and chooses their own password.
 * The email is typed here, never stored in code or config. Refuses if a super admin already exists
 * unless `--force` and the typed confirmation.
 */
import { createInterface } from 'node:readline/promises'
import { schema } from '@eec/db'
import { connectDirect, directUrl } from '@eec/db/node'
import { and, eq, isNull } from 'drizzle-orm'
import { writeAudit } from '../audit.ts'
import { createLink } from '../links.ts'

directUrl()
const force = process.argv.includes('--force')
const origin = process.env.APP_ORIGIN ?? 'http://localhost:8080'
const rl = createInterface({ input: process.stdin, output: process.stdout })
// Piped input (scripts, tests) can end before the database answers: read those lines up front.
const piped: string[] = []
if (!process.stdin.isTTY) for await (const line of rl) piped.push(line)
const ask = async (question: string) =>
  process.stdin.isTTY ? rl.question(question) : (console.log(question), piped.shift() ?? '')
const { db, close } = await connectDirect()

try {
  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.key, 'super-admin'))
  if (!role) throw new Error('System roles missing. Run `pnpm db:seed` first.')

  const existing = await db
    .select({ email: schema.user.email })
    .from(schema.userRoles)
    .innerJoin(schema.user, eq(schema.user.id, schema.userRoles.userId))
    .where(and(eq(schema.userRoles.roleId, role.id), isNull(schema.userRoles.groupId)))
  if (existing.length && !force) {
    console.error(`A super admin already exists (${existing.length}). Use --force to add another.`)
    process.exitCode = 1
  } else {
    if (existing.length) {
      const typed = await ask('Type "AJOUTER UN SUPER ADMIN" to confirm: ')
      if (typed.trim() !== 'AJOUTER UN SUPER ADMIN') throw new Error('Cancelled.')
    }
    const email = (await ask('Super admin email: ')).trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('That does not look like an email address.')
    const [taken] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
    if (taken)
      throw new Error('That email already has an account. Grant the role from the admin instead.')
    const { token, expiresAt } = await createLink(db, {
      kind: 'invite',
      email,
      roles: [{ roleKey: 'super-admin' }],
      createdBy: null,
    })
    await writeAudit(db, process.env.AUTH_SECRET ?? '', {
      actorId: null,
      action: 'bootstrap',
      entityType: 'invitation',
      entityId: email,
      summaryFr: `Invitation de super admin créée pour ${email}`,
      summaryEn: `Super admin invitation created for ${email}`,
    })
    console.log(
      `\nOpen this link (single use, expires ${expiresAt.toISOString()}):\n\n  ${origin}/admin/invite/${token}\n`,
    )
  }
} finally {
  rl.close()
  await close()
}
