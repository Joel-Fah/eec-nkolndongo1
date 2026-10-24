/** The web app manifest, one per language (names, start page and shortcuts); colours come from the design tokens. */
import { locales } from '@eec/i18n'
import type { APIRoute } from 'astro'
import { localeOf, useT } from '../../lib/i18n'
import { href, pages } from '../../lib/nav'

export const prerender = true
export const getStaticPaths = () => locales.map((locale) => ({ params: { locale } }))

export const GET: APIRoute = ({ currentLocale }) => {
  const locale = localeOf(currentLocale)
  const t = useT(locale)
  const to = (id: string) => href(locale, pages.find((p) => p.id === id)?.path[locale] ?? '')
  const body = {
    id: `/${locale}/`,
    name: t('site.name'),
    short_name: 'EEC Nkolndongo 1',
    description: t('pwa.description' as 'site.name'),
    lang: locale,
    start_url: `/${locale}/`,
    scope: '/',
    display: 'standalone',
    // The light theme's page and brand colours (tokens.css: --bg, --primary); the dark ones are used by the meta tags.
    background_color: '#FBF8F1',
    theme_color: '#1F5C3A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: t('nav.items.dimanche.label' as 'site.name'), url: to('dimanche') },
      { name: t('nav.items.evenements.label' as 'site.name'), url: to('evenements') },
      { name: t('nav.items.predications.label' as 'site.name'), url: to('predications') },
    ],
  }
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
