/** Browser side of the registry: each module's admin page, loaded on demand (one chunk per module). */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

export const moduleAdmin: Record<string, LazyExoticComponent<ComponentType>> = {
  departments: lazy(() => import('@eec/module-departments/admin')),
  events: lazy(() => import('@eec/module-events/admin')),
  guides: lazy(() => import('@eec/module-guides/admin')),
  liturgy: lazy(() => import('@eec/module-liturgy/admin')),
  media: lazy(() => import('@eec/module-media/admin')),
  members: lazy(() => import('@eec/module-members/admin')),
  news: lazy(() => import('@eec/module-news/admin')),
  story: lazy(() => import('@eec/module-story/admin')),
  schedule: lazy(() => import('@eec/module-schedule/admin')),
  settings: lazy(() => import('@eec/module-settings/admin')),
}
