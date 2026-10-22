# 0033 — Legal documents are versioned; members are told when the privacy policy changes
**Status:** Accepted · 2026-10-22
**Context:** The privacy policy, the legal notice and the credits must be editable by the parish but also leave a record of
what people agreed to. Consents already store a `policy_version`.
**Decision:**
1. **Versions, never edits**: each document has numbered versions; a new one starts as a draft (a copy of the latest),
   is edited, then published. A published version is immutable. Every version is kept.
2. **The privacy policy's label is the consent's `policy_version`**: new sign-ups record the label in force (built-in
   draft label until the first publication).
3. **Members are informed, and asked again only when needed**: publishing a new privacy version requires a plain-words
   summary; Mon espace then shows « La politique a changé » with it. If the publisher ticks « changement de finalité », the
   member is asked to accept again (a new consent row); otherwise it is information only.
4. **The credits list the Pexels photographers** from the media library, so they cannot drift from the photos in use.
**Consequences:** `legal:update` drafts, `legal:publish` publishes (a dangerous permission). The policy label is read by
name by the API (60 s memo, falls back to the last known value if the database is slow).
