/**
 * The module system's contract (ARCHITECTURE §4). A module declares itself once with `defineModule()`;
 * the API, admin sidebar, permission seed, settings and i18n are all generated from the registry.
 */
import type { IconName } from '@eec/ui/icons'
import type { ZodType } from 'zod'

export type Bilingual = { fr: string; en: string }

export type PermissionDef = {
  /** The action part: `events:publish` is declared as `publish` in module `events`. */
  action: string
  label: Bilingual
  description?: Bilingual
  /** Flagged in the role matrix; confirmations are stricter (export, delete, role changes…). */
  dangerous?: boolean
}

export type AdminNavEntry = {
  /** Sidebar group: content | parish | members | finance | admin | settings. */
  group: 'content' | 'parish' | 'members' | 'finance' | 'admin' | 'settings'
  label: Bilingual
  /** Path inside the admin SPA, e.g. `/media`. */
  path: string
  icon: IconName
  order: number
  /** Entry is hidden unless the user has this permission key. */
  permission: string
}

export type ModuleManifest = {
  id: string
  label: Bilingual
  permissions: PermissionDef[]
  /** Roles can be granted on one group only (department leaders). */
  scopedByGroup?: boolean
  admin?: { nav: AdminNavEntry[] }
  /** The module adds public routes (404 when its flag is off). */
  publicRoutes?: boolean
  /** Fields the module contributes to the Settings module. */
  settingsSchema?: ZodType
  /** Can the super admin switch it off? Core modules can't. */
  toggleable: boolean
  /** Flag value when no settings_flags row exists. */
  flagDefault: boolean
}

export type DefinedModule = ModuleManifest & {
  /** Full permission keys: `<id>:<action>`. */
  permissionKeys: string[]
}

const ID = /^[a-z][a-z0-9-]*$/
const ACTION = /^[a-z][a-z0-9-]*$/

export function defineModule(manifest: ModuleManifest): DefinedModule {
  if (!ID.test(manifest.id)) throw new Error(`Invalid module id: ${manifest.id}`)
  const seen = new Set<string>()
  for (const p of manifest.permissions) {
    if (!ACTION.test(p.action))
      throw new Error(`${manifest.id}: invalid permission action "${p.action}"`)
    if (seen.has(p.action)) throw new Error(`${manifest.id}: duplicate permission "${p.action}"`)
    seen.add(p.action)
  }
  for (const nav of manifest.admin?.nav ?? []) {
    if (!nav.permission.startsWith(`${manifest.id}:`) && manifest.id !== 'core') {
      throw new Error(
        `${manifest.id}: nav entry "${nav.path}" must require one of its own permissions`,
      )
    }
  }
  return {
    ...manifest,
    permissionKeys: manifest.permissions.map((p) => `${manifest.id}:${p.action}`),
  }
}

/** `events:publish` → `{ module: 'events', action: 'publish' }`. */
export function splitPermission(key: string) {
  const i = key.indexOf(':')
  return { module: key.slice(0, i), action: key.slice(i + 1) }
}

/** Is the module on? (flags: module id → enabled, from settings_flags). */
export function isModuleEnabled(m: ModuleManifest, flags: ReadonlyMap<string, boolean>): boolean {
  if (!m.toggleable) return true
  return flags.get(m.id) ?? m.flagDefault
}
