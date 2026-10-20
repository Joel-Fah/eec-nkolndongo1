/** Browser side of the registry: each module's admin page, loaded on demand (one chunk per module). */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

export const moduleAdmin: Record<string, LazyExoticComponent<ComponentType>> = {
  settings: lazy(() => import('@eec/module-settings/admin')),
}
