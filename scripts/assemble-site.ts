/**
 * `pnpm build:site` (after `turbo run build`): puts the admin SPA inside the web build, at ADMIN_PATH, so a
 * single Worker serves site, admin, API and media (decision 0017). The admin was built with the same base
 * (`apps/admin/vite.config.ts`). Prints what it did; changes nothing else.
 */
import { cp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { adminPrefix } from '../packages/core/src/admin-path.ts'
import { envLocal } from './env-local.ts'

const root = join(import.meta.dirname, '..')
const prefix = adminPrefix(envLocal('ADMIN_PATH')) // "/admin"
const from = join(root, 'apps/admin/dist')
const to = join(root, 'apps/web/dist/client', prefix)
await rm(to, { recursive: true, force: true })
await cp(from, to, { recursive: true })
console.log(
  `admin copied to apps/web/dist/client${prefix}/ — deploy with: wrangler deploy --config apps/web/dist/server/wrangler.json`,
)
