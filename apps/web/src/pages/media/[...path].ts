/** Public media files, served on the single origin (decision 0017): /media/<key> streams from the store. */
import { env } from 'cloudflare:workers'
import type { ExecutionContext } from '@cloudflare/workers-types'
import type { Env } from '@eec/api-kit'
import { serveMedia } from '@eec/module-media/serve'
import type { APIRoute } from 'astro'

export const prerender = false

export const ALL: APIRoute = ({ request, locals }) =>
  serveMedia(request, env as unknown as Env, (locals as { cfContext?: ExecutionContext }).cfContext)
