/** The subscribable calendar: /fr/agenda/calendrier.ics[?groupe=key] → the API's cached RFC 5545 feed. */
import { env } from 'cloudflare:workers'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from '@eec/api'
import type { Env } from '@eec/api-kit'
import type { APIRoute } from 'astro'

export const prerender = false
const app = createApp()
export const GET: APIRoute = async ({ request, url, locals }) => {
  const group = /^[a-z0-9-]{1,40}$/.test(url.searchParams.get('groupe') ?? '')
    ? url.searchParams.get('groupe')
    : null
  const res = await app.fetch(
    new Request(
      new URL(
        `/api/events/public/calendar.ics?locale=fr${group ? `&group=${group}` : ''}`,
        request.url,
      ),
    ),
    env as unknown as Env,
    (locals as { cfContext?: ExecutionContext }).cfContext,
  )
  return new Response(res.body, {
    status: res.status,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=600',
      'content-disposition': 'inline; filename="agenda.ics"',
    },
  })
}
