import { Hono } from 'hono'
import type { AppEnv } from './context.ts'
import { withDeps } from './deps.ts'
import { sameOrigin } from './guards.ts'
import { authRoutes } from './routes/auth.ts'
import { invitationRoutes } from './routes/invitations.ts'
import { meRoutes } from './routes/me.ts'
import { memberRoutes } from './routes/members.ts'

export function createApp() {
  const app = new Hono<AppEnv>().basePath('/api')
  app.use('*', sameOrigin)
  app.use('*', withDeps)
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/auth', authRoutes)
  app.route('/me', meRoutes)
  app.route('/members', memberRoutes)
  app.route('/', invitationRoutes)
  app.onError((err, c) => {
    console.error(
      'api error',
      err instanceof Error
        ? `${err.name}: ${err.message} ${(err as { body?: unknown }).body ? JSON.stringify((err as { body?: unknown }).body) : ''}`
        : err,
    )
    return c.json({ error: { code: 'internal' } }, 500)
  })
  app.notFound((c) => c.json({ error: { code: 'not_found' } }, 404))
  return app
}
