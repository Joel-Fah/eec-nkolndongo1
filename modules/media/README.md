# Module `media` — Médiathèque

**Purpose.** The library of photos, audio recordings and PDF documents used by the site. Photos are resized
(480 / 960 / 1600 px, WebP) and stripped of metadata — EXIF, GPS, camera — in the browser before they are sent.
Audio and PDF are stored as they are.

**Data kept.** Table `media_files` (name, kind, sizes, variants, placeholder, FR/EN descriptions, captions,
credit, source) and `media_usages` (where a file is used, so a file in use cannot be deleted). Files live in the
S3-compatible store (Neon Object Storage today, R2 later: four variables and a copy, decision 0020).
**No personal data**, unless someone uploads a photo of people: only with consent (`docs/legal/`).

**Public exposure.** `GET /media/<kind>/<yyyy>/<mm>/<id>/<variant>.<ext>`: immutable, Range, ETag, nosniff, no
listing. The bucket is never public. Astro `<Picture>` renders the variants.

**Rights.** `media:read`, `media:upload`, `media:edit`, `media:delete` (sensitive). Every change is audited.

**Limits.** Photo 15 MB (source), audio 80 MB, PDF 20 MB; the library shows the space used and warns at 70 %.
Files are recognised by their first bytes, never by their name.

**Retention.** Kept until archived or deleted by an authorised person.

**Owners.** Secrétariat (upload, descriptions), super admin (delete).
