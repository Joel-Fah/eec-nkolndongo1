// @ts-check
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
