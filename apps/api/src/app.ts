import { type AppEnv, sameOrigin } from '@eec/api-kit'
import { modules } from '@eec/modules'
import { moduleApis } from '@eec/modules/api'
import { isModuleEnabled } from '@eec/modules-kit'
import { Hono } from 'hono'
import { withDeps } from './deps.ts'
import { auditRoutes } from './routes/audit.ts'
import { authRoutes } from './routes/auth.ts'
import { flagRoutes, flagsFor } from './routes/flags.ts'
import { groupRoutes } from './routes/groups.ts'
import { invitationRoutes } from './routes/invitations.ts'
import { meRoutes } from './routes/me.ts'
import { memberRoutes } from './routes/members.ts'
import { outboxRoutes } from './routes/outbox.ts'
import { roleRoutes } from './routes/roles.ts'
import { searchRoutes } from './routes/search.ts'
import { userRoutes } from './routes/users.ts'

export function createApp() {
  const app = new Hono<AppEnv>().basePath('/api')
  app.use('*', sameOrigin)
  app.use('*', withDeps)
  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.route('/auth', authRoutes)
  app.route('/me', meRoutes)
  app.route('/members', memberRoutes)
  app.route('/', invitationRoutes)
  // Core administration (always on).
  app.route('/users', userRoutes)
  app.route('/roles', roleRoutes)
  app.route('/groups', groupRoutes)
  app.route('/audit', auditRoutes)
  app.route('/outbox', outboxRoutes)
  app.route('/flags', flagRoutes)
  app.route('/search', searchRoutes)
  // Modules from the registry, at /api/<id>. A switched-off module answers 404 (Phase 02 §6.5).
  for (const m of modules) {
    const router = moduleApis[m.id]
    if (!router) continue
    if (m.toggleable)
      app.use(`/${m.id}/*`, async (c, next) => {
        const flags = await flagsFor(c.var.deps.db, c.var.deps.timeoutMs)
        if (!isModuleEnabled(m, flags)) return c.json({ error: { code: 'not_found' } }, 404)
        await next()
      })
    app.route(`/${m.id}`, router)
  }
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
