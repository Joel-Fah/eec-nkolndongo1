// @ts-check

import { readFile, rm, writeFile } from 'node:fs/promises'
import cloudflare from '@astrojs/cloudflare'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { headersFile } from '../../packages/api-kit/src/security-headers.ts'

// Placeholder until the domain is chosen (on hold — see STATUS.md).
const site = 'https://eec-nkolndongo1.joelfah2003.workers.dev'
// `SITE_INDEXABLE=1` at build time = launched. Until then every page, file and header says « do not index ».
const indexable = process.env.SITE_INDEXABLE === '1'
// Stamps the service worker so every deploy gets a new one (the commit when CI builds it, the time otherwise).
const buildId = (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 12)

export default defineConfig({
  site,
  output: 'static',
  adapter: cloudflare({
    imageService: 'compile',
  }),
  session: false,
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
  integrations: [
    {
      // Pexels photos of people are dev-only placeholders (apps/web/src/lib/placeholders.ts): Vite copies
      // public/ into every build, so they are removed from the output before anything can deploy them.
      name: 'eec:drop-dev-placeholders',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          await rm(new URL('placeholders/', dir), { recursive: true, force: true })
        },
      },
    },
    {
      // Security headers for static files (the Worker adds the same ones to everything it serves).
      name: 'eec:headers-file',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          // Keep what the adapter already wrote (immutable cache for /_astro/*) and add ours.
          const file = new URL('_headers', dir)
          const existing = await readFile(file, 'utf8').catch(() => '')
          await writeFile(
            file,
            `${existing.trimEnd()}\n\n${headersFile({ https: site.startsWith('https://'), noindex: !indexable })}`.trimStart(),
          )
        },
      },
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_SITE_INDEXABLE': JSON.stringify(indexable ? '1' : '0'),
      'import.meta.env.PUBLIC_BUILD_ID': JSON.stringify(buildId),
    },
  },
})
