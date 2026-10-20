/** `pnpm --filter @eec/api retention` — runs the retention job once against the DATABASE_URL_UNPOOLED in .env.local. */
import { runRetention } from './retention.ts'

const result = await runRetention({
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  AUTH_SECRET: process.env.AUTH_SECRET ?? '',
  APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:8080',
})
console.log('retention run:', result)
