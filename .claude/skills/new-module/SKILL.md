---
name: new-module
description: Scaffold or extend a feature module (news, events, sermons, giving…) in modules/<id> for the EEC Nkolndongo 1 monorepo. Use whenever adding a new feature, data type, admin section or public section.
---

# New module

Read `ARCHITECTURE.md` §4–5 first. A feature is never spread across apps — it lives in `modules/<id>/`.

## Steps
1. **Decision check** — if the module stores personal data, confirm `docs/legal/data-protection.md`
   allows it; sensitive data needs a decision record first.
2. Create the folder:
   ```
   modules/<id>/
     module.ts      # manifest
     schema.ts      # Drizzle tables, prefixed `<id>_`
     api.ts         # Hono router
     admin/         # React pages (TanStack Router routes)
     web/           # Astro components / route fragments
     i18n/fr.json   # FR first
     i18n/en.json
     README.md      # purpose, fields stored + why, retention, owners
   ```
3. Manifest (`module.ts`):
   ```ts
   export default defineModule({
     id: 'events',
     label: { fr: 'Agenda', en: 'Calendar' },
     permissions: ['events:read', 'events:create', 'events:update', 'events:delete', 'events:publish'],
     scopedByGroup: true,          // department leaders can be limited to their group
     admin: { group: 'vie-paroissiale', icon: 'Calendar03Icon', order: 20 },
     web: { routes: true },
     flagDefault: true,
   })
   ```
4. Register in `modules/registry.ts` (one line).
5. Schema: ids `uuid`, `created_at`, `updated_at`, `created_by`; bilingual fields as
   `title_fr`/`title_en` (FR required, EN optional with FR fallback); `status` (`draft|scheduled|published|archived`)
   for content. Run `pnpm db:generate`.
6. API: validate every input with Zod; call `requirePermission(c, '<id>:<action>', { groupId })` in every
   handler; write to the audit log on mutations; purge edge cache for affected public URLs on publish.
7. Admin: list (data table + filters + empty state illustration), editor (form, autosave draft, preview
   FR/EN), publish action. All strings via i18n.
8. Web: follow the page's signature in `docs/product/pages.md`. Prerender if static, otherwise on-demand + cache.
9. Tests: unit-test permission checks and Zod schemas at minimum.
10. Update `docs/product/roadmap.md` and `STATUS.md`.

## Don'ts
- Don't import another module's internals.
- Don't add a top-level nav tab (max 5 — see `docs/product/navigation.md`).
