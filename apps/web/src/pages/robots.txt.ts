/** robots.txt: closed until launch (SITE_INDEXABLE=1 at build time), then open with the sitemap. */
import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) => {
  const open = import.meta.env.PUBLIC_SITE_INDEXABLE === '1'
  const body = open
    ? `User-agent: *\nAllow: /\nDisallow: /_brand\nDisallow: /fr/verifier\nDisallow: /en/verify\n\nSitemap: ${new URL('sitemap.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n'
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
