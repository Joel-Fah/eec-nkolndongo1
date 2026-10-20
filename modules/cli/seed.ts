/** `pnpm db:seed` — permissions from every module in the registry + system roles. Safe to run any number of times. */
import { seedRbac } from '@eec/auth'
import { assertBranch, connectDirect } from '@eec/db/node'
import { modules } from '../registry.ts'

const branch = assertBranch(['dev', 'production'])
const { db, close } = await connectDirect()
const result = await seedRbac(db, modules)
await close()
console.log(`Seeded Neon branch "${branch}":`, result)
