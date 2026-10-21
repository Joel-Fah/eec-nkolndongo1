# 0026 — Seasonal playground under the footer
**Status:** Accepted · 2026-10-20
**Context:** A delight moment for the footer that follows the liturgical year (leaves in Ordinary Time, stars at
Christmas, flames at Pentecost…), without costing parishioners on mid-range phones and paid data.
**Decision:** A plain canvas and a few lines of physics (gravity, drag, wind, sway, a pile on the floor, pointer
impulses), no library. The drawings are ours (`lib/seasonal-art.ts`), coloured from design tokens. The code
(`scripts/playground.ts`, a few KB) is imported only when the footer is about to be seen, sleeps when everything has
settled or the footer is off screen, and is a still picture with reduced motion or Save-Data. Fewer pieces on
low-end devices. Decorative (`aria-hidden`), never required; a hint line fades after the first touch.
**Consequences:** No cost on first load. New seasons or pieces are added in one file. Touch: a tap scatters the
pieces (a drag still scrolls the page).
