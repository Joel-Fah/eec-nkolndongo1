# 0041 — Fête des Moissons campaigns: validated totals only, entered and validated by two different people
**Status:** Accepted · 2026-10-24 (Joël: « go with the recommendation », group goals as encouragement)
**Context:** The Moissons season needs a public page that shows how the parish is doing toward a goal. Money is sensitive and
the data-protection rules say: no donor data, nothing that is not a verified fact.
**Decision:**
1. **A campaign** has a title, dates (defaults: the Moissons range in Settings), a goal in XAF, a short description (plain text,
   paragraphs: rich text was judged not worth its weight for a few lines), a cover and a state (draft / published).
2. **Progress entries** (`campaign_progress`): amount, date received (never in the future), optional group, an internal note, a
   `validated` flag. **The note is never public and must not name a donor** (the form says so); there is no donor field.
3. **Only validated totals are public.** The public JSON carries sums, never rows.
4. **Two people.** The **treasurer** (`campaigns:read`, `campaigns:progress`) enters; the **secretariat** (`campaigns:read`,
   `campaigns:edit`, `campaigns:validate`) defines campaigns and validates. The API **refuses that someone validates an entry
   they entered themselves** (super admin excepted, since there may be only one person). Editing or deleting a validated entry
   takes its validation away; changing a validated entry's amount is therefore always re-checked.
5. **Group goals** are optional, shown as **encouragement** (« ensemble »): alphabetical, no percentages next to each other, no
   ranking. A ranking view only if Joël asks. Group-scoped roles may enter progress for their own group only.
6. **Public page** (under Agenda, and a highlighted block on Donner): the harvest basket filling toward the goal (static under
   reduced motion, with a text equivalent), amount in `5 000 FCFA`, days left, how to give (validated giving fields only), the
   programme of the season (events in the range), and a **share card drawn server-side as SVG**, cached. No payment, no
   amount collected online (decision 0010).
7. **Season demo:** the page accepts `?simule=YYYY-MM-DD` on `localhost` only, and the API an `asOf` date that can only show
   *earlier* validated totals, so a season can be replayed with dates simulated.
**Consequences:** tables `campaigns`, `campaign_progress`, `campaign_group_goals` (migration 0028); new permissions and grants for
the `tresorier` and `secretariat` roles (seed + grant needed on production); a help guide; `data-protection.md` section.
