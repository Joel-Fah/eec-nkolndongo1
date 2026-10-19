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
