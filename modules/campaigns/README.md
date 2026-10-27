# Module `campaigns` — Campagnes (Fête des Moissons)

**Purpose.** A campaign with a goal, the amounts received (entered by the treasurer, validated by the secretariat) and a public basket of **validated totals only** (decision 0041).

**Data kept.** `campaigns` (title, dates, goal), `campaign_progress` (amount, date received, an optional group, a short note, validation), `campaign_group_goals`. **No donor name, no link to a member.** The internal note must not name anyone.

**Why each field.** Amounts and dates: to follow the campaign. Group: totals per department. Validation: a figure counts publicly only once a second person validated it.

**Exposure.** Public: the validated total (and per-group totals) only. Admin: `campaigns:read|edit|progress|validate`; the treasurer enters but cannot validate, the secretariat validates but cannot enter.

**Retention.** Kept with the campaign (aggregates, no personal data).

**Owners.** Trésorier (entry), secrétariat (definition and validation).
