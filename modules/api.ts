/** Server side of the registry: each module's API router, mounted at /api/<id> (apps/api). */
import type { AppEnv } from '@eec/api-kit'
import { mediaApi } from '@eec/module-media/api'
import { settingsApi } from '@eec/module-settings/api'
import type { Hono } from 'hono'

// biome-ignore lint/suspicious/noExplicitAny: routers have their own schemas; the app only mounts them
export const moduleApis: Record<string, Hono<AppEnv, any, any>> = {
  media: mediaApi,
  settings: settingsApi,
}
