# 0040 — A role and a screen for the content partner to validate and comment
**Status:** Accepted · 2026-10-22
**Context:** Facts (times, address, giving numbers, figures, texts) are public only once validated. The content partner is a
volunteer, not a developer, and should not need broad rights to do it.
**Decision:**
1. New system role **« Validateur de contenu »** (`validateur`): can see what waits (`core:validation-read`), approve settings
   fields, schedule slots and story texts / home figures (`settings:validate`, `schedule:validate`, `story:publish`), and comment
   (`core:validation-comment`). It cannot publish news or events and cannot change roles or users.
2. Admin **« À valider »** (`/validate`) lists, grouped by page, each unvalidated item with its current value, a link to
   the admin field and the public page, **Valider**, **Demander une correction** and **Laisser une remarque**. A comment is
   a row in `content_reviews` (open/resolved), and approving an item resolves its open corrections. Every approval and
   comment is audited; the audit line never carries the comment text.
3. It reads the modules' tables by name (like « À faire »), filtered by what the signed-in person may see.
   `pnpm content:pending` remains the offline version and covers the same sources, plus the tracker and built-in markers.
**Consequences:** The role and the two permissions must be granted on production (seed, then the « Rôles » screen, with
Joël). The two lists are kept in step by convention, not by shared code: a new validation source is added to both.
