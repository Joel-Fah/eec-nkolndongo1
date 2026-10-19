// @ts-check

import { rm } from 'node:fs/promises'
import cloudflare from '@astrojs/cloudflare'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Placeholder until the domain is chosen (on hold — see STATUS.md).
const site = 'https://eec-nkolndongo1.workers.dev'

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
    sitemap({
      // Internal pages (`/_brand`, `/_ui`) never reach the sitemap.
      filter: (page) => !new URL(page).pathname.split('/').some((part) => part.startsWith('_')),
      i18n: { defaultLocale: 'fr', locales: { fr: 'fr-CM', en: 'en-GB' } },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
