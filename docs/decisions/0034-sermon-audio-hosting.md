# 0034 — Sermon audio: the site hosts no audio and processes none (for now); it links to where the file lives
**Status:** Accepted · 2026-10-22 (Joël's direction; revisit when R2 or a domain exists)
**Context:** Sermon audio is the heaviest thing the site could serve (≈ 19 MB for 40 min at 64 kbps). It would exhaust the Neon
Free egress shared with the database (decision 0020), and storing it on Cloudflare needs a payment method (R2). Joël prefers
not to store files in the site's own resources for now and to keep costs at zero.
**Decision:**
1. A sermon has **no uploaded audio**. Staff add **links**: a **YouTube** video (a video, or audio over a still image) and/or a
   **Google Drive** share link to the audio file. The site shows a YouTube facade (nothing loads until play, as in the
   plan) and « Écouter / Télécharger » buttons that open the Drive link in Drive.
2. **No processing on the site**: no in-browser encoder, no audio worker, no upload route for sermons. The earlier plan for
   an in-browser AAC/MP3 encoder (0036) is **parked**, not dropped: it stays documented below for the day a host exists.
3. **No podcast feed for now.** Podcast apps need a direct, stable file address that answers HEAD and byte-range requests
   with the exact length (Apple's requirements). A Google Drive link opens a web page (and a virus-scan page for large files),
   so Apple/Spotify would reject it. Better paths when wanted: **Cloudflare R2** (free egress, needs a card) or the **Internet
   Archive** (free, no card, direct file URLs, a third-party domain on play so it needs Joël's OK).
4. **Any https link is accepted, and none is required** (Joël, 2026-10-22): Drive is only the usual example. A link is
   validated as a plain `https://` address (no `javascript:`, `data:`, plain `http`, credentials or bare hosts), at most 4 per
   sermon, each with an optional name. The page shows the link's host (« S'ouvre sur drive.google.com »), opens it in a new tab
   with `rel="noopener noreferrer"`, and never loads anything from it. Staff are told (help guide) to share a Drive file with
   « Anyone with the link — viewer » and to keep the original in Drive anyway (the archive, decision 0006).
5. Third-party domains: YouTube (already a planned embed, facade only) and drive.google.com as an **outbound link**, never
   loaded by the page.
**For later (parked):** Web Worker encoding (WebCodecs AAC → M4A, JS MP3 fallback), mono 64–96 kbps (Apple recommends 96–128),
upload to R2, RSS per language with exact byte lengths and stable GUIDs, mini-player with Media Session. The plan is in
`docs/phases/PHASE_04_INSTRUCTIONS.md` §4.
**Consequences:** A sermon page can exist with only text, only a YouTube link, only a Drive link, or all three. No audio
bytes ever cross our Worker or our database.
