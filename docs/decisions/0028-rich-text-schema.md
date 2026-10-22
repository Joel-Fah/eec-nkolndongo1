# 0028 — Rich text: a restricted block schema, cleaned on every save
**Status:** Accepted · 2026-10-20
**Context:** News, events, guides, department pages and legal documents need formatted text written by volunteers, shown to
the public, and never able to carry a script or a surprise. A full page-builder or free HTML would be both a security
risk and a maintenance burden.
**Decision:**
1. **A small JSON document** (TipTap/ProseMirror shape) with a fixed list of blocks and marks: paragraphs, headings (two
   levels), bullet/numbered/task lists, quotes, tables, images from the media library, links; bold, italic, underline,
   strike, highlight, sub/superscript, alignment, indent. Nothing else exists in the schema.
2. **Cleaned on the server** by `cleanDoc` (`@eec/core`) on every write and again before rendering: unknown nodes and
   marks are dropped, links must be `https:`/`mailto:`/`tel:` (`safeHref`), images must be library photos, sizes are
   bounded. The browser editor is a convenience, never the authority.
3. **Rendered by our own `renderHtml`** to escaped HTML — no `innerHTML` of stored strings, no third-party sanitiser.
4. **The editor is lazy** (admin only; never on the public site) so the public JS budget is unaffected.
**Consequences:** Hostile-input tests (script tags, `javascript:` links, event handlers, oversized documents, deep nesting)
live in `packages/core/src/richtext.test.ts`. Editors cannot paste arbitrary HTML styling — by design. Adding a block is a
deliberate change to the schema, the cleaner, the renderer and the editor together.
