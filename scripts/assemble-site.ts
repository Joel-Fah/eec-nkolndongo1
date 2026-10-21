/**
 * `pnpm build:site` (after `turbo run build`): puts the admin SPA inside the web build, at ADMIN_PATH, so a
 * single Worker serves site, admin, API and media (decision 0017). The admin was built with the same base
 * (`apps/admin/vite.config.ts`). Prints what it did; changes nothing else.
 */
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { adminPrefix } from '../packages/core/src/admin-path.ts'
import { envLocal } from './env-local.ts'

const root = join(import.meta.dirname, '..')
const prefix = adminPrefix(envLocal('ADMIN_PATH')) // "/admin"
const from = join(root, 'apps/admin/dist')
const to = join(root, 'apps/web/dist/client', prefix)
await rm(to, { recursive: true, force: true })
await cp(from, to, { recursive: true })
// The Worker must know the same admin address and launch state as the build: set them in the built config
// (the source wrangler.jsonc keeps the development defaults).
const configFile = join(root, 'apps/web/dist/server/wrangler.json')
const config = JSON.parse(await readFile(configFile, 'utf8'))
config.vars = {
  ...config.vars,
  ADMIN_PATH: prefix.replace(/^\//, ''),
  SITE_INDEXABLE: envLocal('SITE_INDEXABLE') === '1' ? '1' : '0',
}
// Production database: Hyperdrive in front of Neon. Added here, not in wrangler.jsonc, so local dev (which connects
// straight to the dev branch) never starts Cloudflare's Hyperdrive emulation.
const deploy = JSON.parse(await readFile(join(root, 'apps/web/deploy.json'), 'utf8')) as {
  hyperdriveId?: string
}
if (deploy.hyperdriveId) config.hyperdrive = [{ binding: 'HYPERDRIVE', id: deploy.hyperdriveId }]
await writeFile(configFile, JSON.stringify(config))
console.log(
  `Worker vars: ADMIN_PATH=${config.vars.ADMIN_PATH} SITE_INDEXABLE=${config.vars.SITE_INDEXABLE}`,
)
console.log(
  `admin copied to apps/web/dist/client${prefix}/ — deploy with: wrangler deploy --config apps/web/dist/server/wrangler.json`,
)
