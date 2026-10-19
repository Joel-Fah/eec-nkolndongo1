import { Hono } from 'hono'
import type { AppEnv } from '../context.ts'
import { publicRoute } from '../guards.ts'

/**
 * Better Auth's own endpoints (sign-in, sign-up, sign-out, sessions, password reset request).
 * Public by nature; they carry their own rate limits, password policy and Origin checks.
 */
export const authRoutes = new Hono<AppEnv>()
  .post(
    '/*',
    publicRoute('Better Auth endpoints: rate-limited, Origin-checked, password policy enforced'),
    async (c) => (await c.var.deps.auth()).handler(c.req.raw),
  )
  .get('/*', async (c) => (await c.var.deps.auth()).handler(c.req.raw))
