# 0045 — Proposed Sunday figures: the editor proposes, the secretariat and the treasurer validate
**Status:** Accepted · 2026-10-25 (Joël: the editor often reads the figures out at the end of the service and can enter them right there; they must be validated by the role they belong to before they count)
**Context:** Attendance belongs to the secretariat and offerings to the treasurer (0043), but the figures are known in the room, at the end of the service, by the person who reads them out.
**Decision:**
1. New permission **`sundays:propose`** (granted to the `editeur` role, with `sundays:read`). A proposer enters attendance and offering lines (any group); they are **pending**.
2. **Pending figures count nowhere**: not in the Sunday's totals, the trends, the dashboard card, the CSV export, nor, for a « moissons » line, in the campaign (the unvalidated campaign entry is created only when the line is validated). They are shown, marked « À valider », and the pending amount is shown apart.
3. **Validation:** the secretariat (`sundays:attendance`) validates attendance; the treasurer (`sundays:offerings`, or a group's leader for their group's lines) validates offering lines. Entering or editing as a validator is itself validation. A proposer can correct what is still pending but **never overwrite what is validated**, and may delete only pending lines.
4. **A Sunday cannot be closed while something is pending.**
5. **Notifications** (0044) tell the validators: one « Bilan du … à valider » per Sunday, worked out when their list is read, closed by itself once validated.
6. **Also in 0044's list:** « Fête des Moissons : n entrée(s) à valider » for people who may validate campaign entries (one a week while there are any), and a **weekly summary** (« Cette semaine, n choses vous attendent ») that sums everything waiting. Nothing is sent by email or push: in-app only, shown the next time the person opens the app (no scheduler is needed).
**Not built:** a per-person mute (silencing one kind of notification); push; email digest.
**Consequences:** migration 0032 (`sunday_reports.attendance_pending`, `sunday_offerings.pending`, both default false: existing rows are unaffected). System-role grants are only written when a role is created: **on each environment, grant `sundays:read` and `sundays:propose` to the Editor role in Rôles.**
