/** `pnpm db:seed` — permissions from manifests + system roles. Safe to run any number of times. */
import { assertBranch, connectDirect } from '@eec/db/node'
import { coreModule } from '../core-module.ts'
import { seedRbac } from '../seed.ts'

const branch = assertBranch(['dev', 'production'])
const { db, close } = await connectDirect()
const result = await seedRbac(db, [coreModule])
await close()
console.log(`Seeded Neon branch "${branch}":`, result)
