# Module `story` — Pages du site

**Purpose.** The words and people of the story pages. The pages' structure and animation stay in code; this module holds
**content slots** (declared per page in `@eec/core` `PAGE_SLOTS`), the **history milestones** of « Gravir la colline »,
and the **council** of « Pasteurs et Conseil ». Not a page builder.

**Data kept.** `page_slots`, `history_milestones`, `council_members` (name, role, optional photo and term, **public
consent** with who recorded it and when).

**Public exposure.** `/api/story/public`: published slots and milestones only; council **names and photos only with
consent** (otherwise the role alone). An unpublished slot never replaces the built-in text.

**Rights.** `story:read`, `story:edit`, `story:publish`, `story:council`. Editing a published slot or milestone puts it
back to draft unless the editor may publish.

**Retention.** Kept until deleted; removing a council member deletes their row; consent changes are in the audit trail.
