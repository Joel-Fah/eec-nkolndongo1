/**
 * The API lives on the same origin as the site (decision 0017). Everything under /api/* is handled by our
 * Hono app (packages: apps/api). On-demand: it never runs for prerendered pages or static assets.
 */

import { env } from 'cloudflare:workers'
import { createApp } from '@eec/api'
import type { Env } from '@eec/api/env'
import type { APIRoute } from 'astro'

export const prerender = false

const app = createApp()
export const ALL: APIRoute = ({ request }) => app.fetch(request, env as unknown as Env)
