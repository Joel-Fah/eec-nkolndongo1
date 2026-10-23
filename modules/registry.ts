/**
 * The single list of modules (Phase 02 §6). Everything that depends on "which modules exist" reads it:
 * the API mounts, the admin sidebar and routes, the permission seed, the feature flags.
 * Core (users, roles, groups, audit) is always on; the others can be toggleable.
 * Data only — no server or browser code here, so both the API and the admin can import it.
 */
import { coreModule } from '@eec/auth/core-module'
import { bulletinModule } from '@eec/module-bulletin'
import { contactModule } from '@eec/module-contact'
import { departmentsModule } from '@eec/module-departments'
import { eventsModule } from '@eec/module-events'
import { guidesModule } from '@eec/module-guides'
import { legalModule } from '@eec/module-legal'
import { liturgyModule } from '@eec/module-liturgy'
import { mediaModule } from '@eec/module-media'
import { meditationsModule } from '@eec/module-meditations'
import { membersModule } from '@eec/module-members'
import { newsModule } from '@eec/module-news'
import { scheduleModule } from '@eec/module-schedule'
import { sermonsModule } from '@eec/module-sermons'
import { settingsModule } from '@eec/module-settings'
import { storyModule } from '@eec/module-story'
import type { DefinedModule } from '@eec/modules-kit'

export const modules: readonly DefinedModule[] = [
  coreModule,
  settingsModule,
  mediaModule,
  membersModule,
  newsModule,
  sermonsModule,
  meditationsModule,
  bulletinModule,
  eventsModule,
  scheduleModule,
  liturgyModule,
  departmentsModule,
  guidesModule,
  storyModule,
  contactModule,
  legalModule,
]

export const moduleById = (id: string) => modules.find((m) => m.id === id)
