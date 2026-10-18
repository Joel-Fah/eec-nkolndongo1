# 0005 — Neon Auth for identity, our own RBAC
**Status:** Accepted · 2026-10-19
**Context:** Staff need configurable roles, groups and permissions defined by a super admin; members need
accounts on the public site (headcount now, member services later).
**Decision:** Neon Auth (managed Better Auth) handles sign-up/sign-in/sessions. Authorization lives in our
tables (`roles`, `permissions`, `role_permissions`, `groups`, `user_roles` with optional group scope) and is
enforced in the API. Modules declare permissions in their manifest. If managed Neon Auth blocks a needed
capability, fall back to self-hosted Better Auth on the same database (low migration cost).
**Consequences:** One identity for staff and members; admin access is purely a matter of roles.
