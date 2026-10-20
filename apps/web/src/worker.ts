/**
 * Worker entry (`main` in wrangler.jsonc): Astro's Cloudflare handler, with one gate in front of it.
 *
 * The living guide (/fr/_brand/, /en/_brand/) is a static page but internal (Phase 02 §5.5): only a session
 * holding `core:system-design` may read it; anyone else gets the normal 404. Static files are normally served
 * before any Worker code, so `run_worker_first` (wrangler.jsonc) routes these two paths here; once allowed,
 * Astro's handler serves the prebuilt page as usual — no render cost on the Worker.
 */

import { handle } from '@astrojs/cloudflare/handler'
import type { ExecutionContext } from '@cloudflare/workers-types'
import { createApp } from '@eec/api'
import type { Env } from '@eec/api-kit'

type Bindings = Env
const GUIDE = /^\/(fr|en)\/_brand\/?$/

let api: ReturnType<typeof createApp> | undefined

async function mayReadGuide(request: Request, env: Bindings, ctx: ExecutionContext) {
  const cookie = request.headers.get('cookie')
  if (!cookie) return false
  api ??= createApp()
  const me = await api.fetch(
    new Request(new URL('/api/me', request.url), { headers: { cookie } }),
    env,
    ctx,
  )
  if (!me.ok) return false
  const { permissions } = (await me.json()) as { permissions?: string[] }
  return !!permissions?.some((p) => p === '*' || p === 'core:system-design')
}

/** Allowed: Astro serves the page as usual (static file in production, rendered in dev). Otherwise: 404. */
async function guide(request: Request, env: Bindings, ctx: ExecutionContext) {
  const url = new URL(request.url)
  const allowed = await mayReadGuide(request, env, ctx).catch(() => false)
  const res = allowed
    ? await handle(request, env as never, ctx)
    : await handle(
        new Request(new URL('/404/', url), { headers: request.headers }),
        env as never,
        ctx,
      )
  const headers = new Headers(res.headers)
  headers.set('cache-control', 'private, no-store')
  headers.set('x-robots-tag', 'noindex')
  return new Response(res.body, { status: allowed ? res.status : 404, headers })
}

export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    if (GUIDE.test(new URL(request.url).pathname)) return guide(request, env, ctx)
    return handle(request, env as never, ctx)
  },
}
