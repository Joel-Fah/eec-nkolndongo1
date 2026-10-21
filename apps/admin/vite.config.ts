import { readdirSync } from 'node:fs'
import { adminBase } from '@eec/core'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { envLocal } from '../../scripts/env-local.ts'
import { ADMIN_NAMESPACES } from './i18n-prefixes.ts'

const modulesDir = new URL('../../modules/', import.meta.url)
const moduleIds = readdirSync(modulesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'node_modules' && d.name !== 'cli')
  .map((d) => d.name)
const keep = new RegExp(`^export \\* from './(${[...ADMIN_NAMESPACES, ...moduleIds].join('|')})_`)

/** Prunes Paraglide's message barrel to the namespaces the admin uses (see i18n-prefixes.ts). */
const pruneMessages = {
  name: 'eec:prune-admin-messages',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('/paraglide/messages/_index.js')) return null
    return code
      .split('\n')
      .filter((line) => !line.startsWith('export * from') || keep.test(line))
      .join('\n')
  },
}

// The admin lives under ADMIN_PATH (default /admin/) on the single origin (decisions 0017, 0025).
export default defineConfig({
  base: adminBase(envLocal('ADMIN_PATH')),
  plugins: [
    pruneMessages,
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
})
