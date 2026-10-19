/** Apply committed SQL migrations with the direct URL. `pnpm db:migrate` (loads ../../.env.local). */
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { connectDirect } from '../node.ts'

const { db, close } = await connectDirect()
console.log(`Migrating Neon branch: ${process.env.NEON_BRANCH}`)
await migrate(db, { migrationsFolder: new URL('../../migrations', import.meta.url).pathname })
await close()
console.log('Migrations applied.')
