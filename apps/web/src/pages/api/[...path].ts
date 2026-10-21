/**
 * The API lives on the same origin as the site (decision 0017). Everything under /api/* is handled by our
 * Hono app (packages: apps/api). On-demand: it never runs for prerendered pages or static assets.
 */

import { env } from 'cloudflare:workers'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from '@eec/api'
import type { Env } from '@eec/api-kit'
import type { APIRoute } from 'astro'

export const prerender = false

const app = createApp()
// cfContext gives waitUntil (background cache refreshes); absent in some dev paths, which is fine.
export const ALL: APIRoute = ({ request, locals }) =>
  app.fetch(request, env as unknown as Env, (locals as { cfContext?: ExecutionContext }).cfContext)
