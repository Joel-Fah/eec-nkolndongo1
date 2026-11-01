# 0048 — System-role grants are offered once, by the seed
**Status:** Accepted · 2026-10-26 (Joël: « a ledger: offer each grant once »)
**Context:** Until now a system role's grants were written only when the role was first created, so every permission added later had to be granted by hand in Rôles on each environment (Phase 04 needed a long checklist). The seed must stop being something to remember, without ever overwriting what someone decided in the admin.
**Decision:**
1. A **ledger** table `role_permission_offers (role_id, permission_key)` records every system-role grant the seed has already offered (migration 0036, additive).
2. On every seed, for each system role (new or existing), the grants **in code** that the manifests declare and that are **not in the ledger** are inserted into `role_permissions` (`on conflict do nothing`) and recorded in the ledger. The logic is the pure function `missingGrants` (tested).
3. The seed **never deletes**. A grant added by hand is untouched. A grant removed on purpose in Rôles **stays removed**, because it is already in the ledger. A grant that is not in the code is not touched.
4. The first seed on an environment offers every grant of the system roles that is missing (on production this is intended: the Phase 04 list). A grant an admin removed **before** the ledger existed cannot be told apart from one never given, so it is offered once: remove it again.
5. `modules/scope.test.ts` checks that every grant in `systemRoles` is a permission a manifest declares (otherwise the seed would drop it silently).
**Consequences:** `pnpm db:seed` after a deploy is enough to give new permissions to the roles that should hold them; the « grant by hand » step in the runbook is gone except for decisions about roles that no system role holds (listed in `docs/ops/release-phase-04.md`). Applies to production with the Phase 05A merge (migration 0036 + seed).
