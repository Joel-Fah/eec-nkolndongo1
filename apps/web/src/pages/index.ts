import { pickLocale } from '@eec/i18n'
import type { APIRoute } from 'astro'

// The only on-demand route: `/` sends visitors to /fr/ or /en/ based on their browser language.
export const prerender = false

export const GET: APIRoute = ({ request }) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: `/${pickLocale(request.headers.get('accept-language'))}/`,
      Vary: 'Accept-Language',
      'Cache-Control': 'private, max-age=0',
    },
  })
