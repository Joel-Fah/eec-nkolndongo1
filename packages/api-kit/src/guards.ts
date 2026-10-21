import { can, type Principal } from '@eec/auth'
import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from './context.ts'

export const fail = (c: Context, status: 400 | 401 | 403 | 404 | 409 | 429, code: string) =>
  c.json({ error: { code } }, status)

type Guarded = MiddlewareHandler<AppEnv> & { __guard?: string; __public?: string }

/**
 * Every mutating route must start with one of these (the route-table test enforces it).
 * `group` resolves the group id of the resource for group-scoped roles.
 */
export function requirePermission(
  permission: string,
  opts: { group?: (c: Context<AppEnv>) => string | undefined } = {},
): Guarded {
  const mw: Guarded = async (c, next) => {
    const actor = await c.var.deps.actor()
    if (!actor) return fail(c, 401, 'unauthenticated')
    if (!can(actor.principal as Principal, permission, { groupId: opts.group?.(c) }))
      return fail(c, 403, 'forbidden')
    await next()
  }
  mw.__guard = permission
  return mw
}

/** Signed-in user acting on their own data (profile, password, sessions). */
export function requireSelf(): Guarded {
  const mw: Guarded = async (c, next) => {
    const actor = await c.var.deps.actor()
    if (actor?.principal.status !== 'active') return fail(c, 401, 'unauthenticated')
    await next()
  }
  mw.__guard = 'self'
  return mw
}

/** An intentionally anonymous mutation (sign-up, link redemption). Must say why. */
export function publicRoute(reason: string): Guarded {
  const mw: Guarded = async (_c, next) => next()
  mw.__public = reason
  return mw
}

/** CSRF: browsers always send Origin on cross-site POSTs; ours must match the single origin. */
export const sameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return next()
  const origin = c.req.header('origin')
  const site = c.req.header('sec-fetch-site')
  const ok = origin
    ? origin === c.env.APP_ORIGIN
    : site === undefined || site === 'same-origin' || site === 'none'
  if (!ok) {
    // Not a secret: tells you which address to use when the site is opened from the wrong one.
    console.warn(`bad_origin: request from "${origin ?? site}", expected "${c.env.APP_ORIGIN}"`)
    return fail(c, 403, 'bad_origin')
  }
  return next()
}

export const clientIp = (c: Context) =>
  c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null
