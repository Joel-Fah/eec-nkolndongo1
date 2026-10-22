---
name: new-module
description: Scaffold or extend a feature module (news, events, sermons, giving…) in modules/<id> for the EEC Nkolndongo 1 monorepo. Use whenever adding a new feature, data type, admin section or public section.
---

# New module

Read `ARCHITECTURE.md` §4–6 first. A feature is never spread across apps — it lives in `modules/<id>/`, a
workspace package `@eec/module-<id>`. The reference implementation is `modules/settings`.

## Steps
1. **Decision check** — personal data? Confirm `docs/legal/data-protection.md` allows it; sensitive data needs
   a decision record first.
2. Folder (copy `modules/settings` for package.json / tsconfig):
   ```
   modules/<id>/
     package.json        # "@eec/module-<id>", exports: ".", "./api", "./admin", "./schema"
     src/index.ts        # public entry: manifest + shared types/Zod schemas — the only thing others import
     src/schema.ts       # Drizzle tables, prefixed `<id>_` (drizzle-kit reads modules/*/src/schema.ts)
     src/api.ts          # Hono router
     src/admin.tsx       # default-exported admin page
     i18n/fr.json        # FR first; keys become `<id>.…` after the merge
     i18n/en.json        # same keys (parity test)
     README.md           # purpose, fields stored + why, retention, owners
   ```
3. Manifest (`src/index.ts`):
   ```ts
   import { defineModule } from '@eec/modules-kit'
   export const eventsModule = defineModule({
     id: 'events',
     label: { fr: 'Agenda', en: 'Calendar' },
     toggleable: true,       // the super admin can switch it off (API 404, menu hidden)
     flagDefault: true,
     scopedByGroup: true,    // roles can be granted for one group (department leaders)
     publicRoutes: true,
     permissions: [
       { action: 'read', label: { fr: 'Voir l’agenda', en: 'View the calendar' } },
       { action: 'publish', label: { fr: 'Publier un événement', en: 'Publish an event' }, dangerous: false },
     ],
     admin: { nav: [{ group: 'parish', label: { fr: 'Agenda', en: 'Calendar' }, path: '/m/events', icon: 'calendar', order: 10, permission: 'events:read' }] },
   })
   ```
4. Register: one line each in `modules/registry.ts` (manifest), `modules/api.ts` (router),
   `modules/admin.ts` (lazy page); add the package to `modules/package.json` dependencies. Then
   `pnpm install`, `pnpm db:generate` (migration in its own commit), `pnpm db:migrate`, `pnpm db:seed`.
5. Schema: ids `uuid` (`id()` from `@eec/db/columns`), `timestamps()`, `created_by`; bilingual fields
   `title_fr`/`title_en` (FR required, EN falls back to FR); `status` (`draft|scheduled|published|archived`).
6. API (`src/api.ts`), with `@eec/api-kit`:
   ```ts
   export const eventsApi = new Hono<AppEnv>()
     .get('/', requirePermission('events:read'), async (c) => { … })
     .post('/', requirePermission('events:publish', { group: (c) => c.req.param('groupId') }), zValidator('json', schema), async (c) => {
       … ; await audit(c, { action: 'publish', entityType: 'event', entityId, summaryFr, summaryEn, diff })
       await bumpContentVersion(db, 'events')   // public caches pick it up within seconds
     })
     .get('/public', (c) => cachedJson(c, { key: `events/v${await contentVersion(db, 'events')}`, ttl: 120, keep: 604800, load }))
   ```
   Every mutating route needs `requirePermission` / `requireSelf` / `publicRoute('why')` — the route-table
   test fails otherwise. Validate everything with Zod. Audit every mutation.
7. Admin (`src/admin.tsx`): `@eec/admin-kit` (`api`, `useLocale`, `useMe`, `hasPermission`) +
   `@eec/ui/react` primitives. List with filters and an illustrated empty state, editor in a sheet,
   confirmations for destructive actions, toasts with undo where reversible. All strings via i18n.
8. Web: follow the page's signature in `docs/product/pages.md`. Static pages never wait for the database:
   read public JSON (edge-cached) or render on demand with the cache helpers.
9. Tests: Zod schemas, permission checks, and `modules/boundaries.test.ts` stays green (no app imports, no
   deep imports into other modules).
10. Document new components on `/_brand`; update `docs/product/roadmap.md` and `STATUS.md`.

## The content kit (Phase 03)
- Rich text: `cleanDoc`/`renderHtml` from `@eec/core`; the editor is `@eec/content-kit/editor` (lazy, admin only).
- A module with draft → publish → archive: `contentRoutes` from `@eec/api-kit` (revisions, scheduling, preview links, audit,
  cache-version bump, group-scoped rights). Simpler modules (guides, story, departments) keep a plain `state` column.
- Public pages read the module's `/public` JSON through `publicJson` and render on demand; wrap loads in `cachedJson` with a
  content version in the key, and never let a cold database turn a page into a 500 (`<UnavailableState>`).
- People's names or photos: public only with a recorded consent (who, when) and sent by the server only then (decision 0031).
- Forms and dialogs: `GuardedDialog` (confirms before discarding), `ViewToggle`, `ShortcutTip`. Public filters: mark the
  results `data-live-area` and the links `data-live-nav` so they swap without reloading.
- Cross-module reads (search, « À faire ») go in the registry package or `apps/api`, never as a module importing another's internals.
- Document every new component in `/_brand` in the same change.

## Don'ts
- Don't import another module's internals (only `@eec/module-<id>`), or anything from `apps/*`.
- Don't add a top-level nav tab (max 5 — see `docs/product/navigation.md`).
- Don't commit generated files (merged messages, illustrations, fonts).
