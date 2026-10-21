/** Node-only helpers for CLIs (migrate, seed, bootstrap). Reads the DIRECT url from the environment. */
import { connect } from './index.ts'

export function directUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED
  if (!url)
    throw new Error(
      'DATABASE_URL_UNPOOLED is not set. Run: neon env pull --branch dev --file .env.local',
    )
  return url
}

export async function connectDirect() {
  return connect(directUrl())
}

/** Refuse to touch production by accident. */
export function assertBranch(allowed: string[]) {
  const branch = process.env.NEON_BRANCH ?? 'unknown'
  if (!allowed.includes(branch)) {
    throw new Error(`Refusing to run on Neon branch "${branch}" (allowed: ${allowed.join(', ')}).`)
  }
  return branch
}

/**
 * A guard for commands that change data: on any branch other than `dev`, a person at a keyboard must type the branch
 * name first. CI (no keyboard) is not asked: its deploy workflow is the intended path to production.
 */
export async function confirmNotDev(action: string) {
  const branch = process.env.NEON_BRANCH ?? 'unknown'
  if (branch === 'dev') return
  // CI has no keyboard; the first-deploy script has already asked the person to type DEPLOY (EEC_CONFIRMED).
  if (!process.stdin.isTTY || process.env.CI || process.env.EEC_CONFIRMED) return
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const host = new URL(directUrl()).host
  console.log(`\n⚠  ${action} on the "${branch}" database (${host}).`)
  const answer = await rl.question(`Type ${branch} to continue: `)
  rl.close()
  if (answer.trim() !== branch) {
    console.log('Cancelled.')
    process.exit(1)
  }
}
