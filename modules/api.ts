/** Server side of the registry: each module's API router, mounted at /api/<id> (apps/api). */
import type { AppEnv } from '@eec/api-kit'
import { eventsApi } from '@eec/module-events/api'
import { liturgyApi } from '@eec/module-liturgy/api'
import { mediaApi } from '@eec/module-media/api'
import { membersApi } from '@eec/module-members/api'
import { newsApi } from '@eec/module-news/api'
import { scheduleApi } from '@eec/module-schedule/api'
import { settingsApi } from '@eec/module-settings/api'
import type { Hono } from 'hono'

// biome-ignore lint/suspicious/noExplicitAny: routers have their own schemas; the app only mounts them
export const moduleApis: Record<string, Hono<AppEnv, any, any>> = {
  liturgy: liturgyApi,
  media: mediaApi,
  events: eventsApi,
  members: membersApi,
  news: newsApi,
  schedule: scheduleApi,
  settings: settingsApi,
}
