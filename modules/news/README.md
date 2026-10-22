# Module `news` — Actualités

**Purpose.** Parish news: announcements, reports, invitations. Bilingual (French required, English optional, with a note
when missing), a lifecycle (draft → scheduled → published → archived), earlier versions, secret preview links, RSS.

**Data kept.** Table `news_posts` (titles, summaries, rich-text bodies as JSON, cover, slug, dates, group); shared
`content_revisions` and `content_redirects`; `media_usages` rows for photos used. **No personal data about
parishioners.** Staff ids appear only as `created_by` / `updated_by` and in the audit log.

**Public exposure.** Cached JSON at `/api/news/public*`, pages under `/fr/actualites/nouvelles/` (`/en/news/latest/`),
RSS at `/api/news/public/feed.xml`. Only what is live now (published, start passed, end not reached).

**Rights.** `news:read`, `news:edit`, `news:publish`, `news:delete` (sensitive); all can be granted for one group.

**Retention.** Kept until archived or deleted; revisions are limited to the last 50 per post.
