/**
 * The admin SPA is built into /admin as static assets. Any /admin/* URL that is not a real file (a
 * client-side route such as /admin/users) gets the SPA shell, so deep links and reloads work.
 */

import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'

export const prerender = false

export const GET: APIRoute = ({ request }) => {
  const assets = (env as unknown as { ASSETS: { fetch: (r: Request) => Promise<Response> } }).ASSETS
  return assets.fetch(new Request(new URL('/admin/index.html', request.url), request))
}
