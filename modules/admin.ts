/** Browser side of the registry: each module's admin page, loaded on demand (one chunk per module). */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

export const moduleAdmin: Record<string, LazyExoticComponent<ComponentType>> = {
  media: lazy(() => import('@eec/module-media/admin')),
  members: lazy(() => import('@eec/module-members/admin')),
  settings: lazy(() => import('@eec/module-settings/admin')),
}
