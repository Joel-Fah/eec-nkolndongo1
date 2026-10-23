/** Server side of the registry: each module's API router, mounted at /api/<id> (apps/api). */
import type { AppEnv } from '@eec/api-kit'
import { contactApi } from '@eec/module-contact/api'
import { departmentsApi } from '@eec/module-departments/api'
import { eventsApi } from '@eec/module-events/api'
import { guidesApi } from '@eec/module-guides/api'
import { legalApi } from '@eec/module-legal/api'
import { liturgyApi } from '@eec/module-liturgy/api'
import { mediaApi } from '@eec/module-media/api'
import { meditationsApi } from '@eec/module-meditations/api'
import { membersApi } from '@eec/module-members/api'
import { newsApi } from '@eec/module-news/api'
import { scheduleApi } from '@eec/module-schedule/api'
import { sermonsApi } from '@eec/module-sermons/api'
import { settingsApi } from '@eec/module-settings/api'
import { storyApi } from '@eec/module-story/api'
import type { Hono } from 'hono'

// biome-ignore lint/suspicious/noExplicitAny: routers have their own schemas; the app only mounts them
export const moduleApis: Record<string, Hono<AppEnv, any, any>> = {
  contact: contactApi,
  departments: departmentsApi,
  guides: guidesApi,
  legal: legalApi,
  liturgy: liturgyApi,
  media: mediaApi,
  events: eventsApi,
  members: membersApi,
  news: newsApi,
  sermons: sermonsApi,
  meditations: meditationsApi,
  story: storyApi,
  schedule: scheduleApi,
  settings: settingsApi,
}
