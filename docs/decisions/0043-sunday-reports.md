# 0043 — Sunday reports: attendance and offerings as aggregates, entered by two roles
**Status:** Accepted · 2026-10-24 (Joël: secretariat enters attendance, treasurer enters offerings; Moissons offerings linked to the campaign)
**Context:** Every Sunday the previous Sunday's figures are communicated (men, women, children, offerings and what they are for).
Recording them lets the parish see weekly and monthly trends. It is new data, so its limits are written down first.
**Decision:**
1. **Module `sundays`** (« Bilan du dimanche »). One report per Sunday date (unique; no foreign key to liturgy, so either module can be
   switched off). Not called « attendance »: the roadmap's attendance means per-member check-in, which stays out of scope.
2. **Attendance** is three counts: men, women, children. **Aggregates only**: no name, no list, no member link. A free internal note
   (≤ 120 characters) must not name anyone.
3. **Offerings** are lines: a **purpose**, an amount in XAF, an optional **group**, an optional campaign. Purposes are an open field
   with presets for the recurring ones (ordinaire, dîme, travaux, Moissons, reconnaissance, autre); other purposes are typed and
   suggested next time. **No group = the congregation** (ordinary offerings are shared among groups when a group is named).
   **No donor is ever recorded.**
4. **Moissons link.** A line with purpose « Moissons » may name a campaign: it then **creates one `campaign_progress` entry** (same
   amount, not validated) that counts in the public total only once the secretariat validates it (0041); no double entry and no double
   counting. Unlinking or deleting the line removes the entry while it is unvalidated.
5. **Two roles.** `sundays:attendance` (secretariat), `sundays:offerings` (treasurer, group-scoped lines for group leaders),
   `sundays:close` (the secretariat closes a Sunday: no edit afterwards without reopening), `sundays:read`, `sundays:export`
   (dangerous: super admin and secretariat, audited by row count). A group leader sees only their group's offering lines.
6. **Never public.** Money is not shown on the site. The audit log carries neither counts nor amounts.
7. **Analytics** (admin only): last Sunday card, weekly and monthly trends of attendance and offerings by purpose and by group,
   a numbers table under every chart, CSV export.
**Consequences:** tables `sunday_reports`, `sunday_offerings` (migration 0029); grants for `secretariat`, `tresorier`, `pasteur`
(read) — to be granted in Rôles on each environment; help guide; `data-protection.md` section.

**Amended by 0044:** a report may be made for any day; a day that is not a Sunday is a special day and must be named.
