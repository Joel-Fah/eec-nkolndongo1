/** Browser side of the registry: each module's admin page, loaded on demand (one chunk per module). */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

export const moduleAdmin: Record<string, LazyExoticComponent<ComponentType>> = {
  contact: lazy(() => import('@eec/module-contact/admin')),
  departments: lazy(() => import('@eec/module-departments/admin')),
  events: lazy(() => import('@eec/module-events/admin')),
  guides: lazy(() => import('@eec/module-guides/admin')),
  legal: lazy(() => import('@eec/module-legal/admin')),
  liturgy: lazy(() => import('@eec/module-liturgy/admin')),
  media: lazy(() => import('@eec/module-media/admin')),
  members: lazy(() => import('@eec/module-members/admin')),
  news: lazy(() => import('@eec/module-news/admin')),
  sermons: lazy(() => import('@eec/module-sermons/admin')),
  meditations: lazy(() => import('@eec/module-meditations/admin')),
  bulletin: lazy(() => import('@eec/module-bulletin/admin')),
  campaigns: lazy(() => import('@eec/module-campaigns/admin')),
  registrations: lazy(() => import('@eec/module-registrations/admin')),
  story: lazy(() => import('@eec/module-story/admin')),
  schedule: lazy(() => import('@eec/module-schedule/admin')),
  settings: lazy(() => import('@eec/module-settings/admin')),
}

/** Pieces of a module's screen shown inside another screen (a group's public page, edited from Groups). */
export const GroupPageEditor = lazy(() =>
  import('@eec/module-departments/admin').then((m) => ({ default: m.GroupPageEditor })),
)
export const DepartmentQuizEditor = lazy(() =>
  import('@eec/module-departments/admin').then((m) => ({ default: m.QuizEditor })),
)
