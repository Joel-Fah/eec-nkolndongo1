/**
 * Only these message namespaces are bundled into the admin (the public site's pages, brand guide, hero texts…
 * are not needed there and weigh ~40 KB gzipped). `vite.config.ts` filters Paraglide's message barrel with this
 * list and `i18n-prefixes.test.ts` fails when admin code uses a namespace that is not listed.
 * Module namespaces (settings, media, members…) are added automatically from `modules/*`.
 */
export const ADMIN_NAMESPACES = [
  'admin',
  'auth',
  'bible',
  'common',
  'content',
  'dash',
  'footer',
  'lockup',
  'login',
  'nav',
  'notfound',
  'season',
  'site',
  'soon',
  'ui',
] as const
