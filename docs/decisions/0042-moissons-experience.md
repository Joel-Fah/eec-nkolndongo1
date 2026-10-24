# 0042 — The Moissons page is a members' experience, only during the season (amends the public side of 0041)
**Status:** Accepted · 2026-10-24 (Joël's feedback on Checkpoint D)
**Context:** The first public Moissons page (basket, figures, groups, how to give, programme, share card) was flat, repeated the
progress and was always on. Joël wants it only in season, for members, and with the calm, immersive feel of « Ce dimanche ».
**Decision:**
1. **Season only.** The page and its menu entry show while the campaign runs plus a 7-day grace; outside it, the URL shows a gentle
   « rendez-vous l'an prochain » (last season's thank-you total for members). The Donner highlight follows the same rule.
2. **Members only.** A signed-in member (staff and super admin count) sees the full page. A visitor sees a warm teaser **without any
   amount** and a « Se connecter / Créer mon espace » path. The page is `private, no-store`, `noindex`, never kept by the service
   worker. The API stays public-safe (validated totals only, 0041): the gate is at the page, which never asks for amounts for a visitor.
3. **One story, top to bottom** (hero unchanged): what we gather together (the single place for progress: the basket fills, the
   amount counts up), everyone brings something (groups as a field of small baskets, encouragement, no ranking), the week ahead
   (events as a ribbon), giving simply (approved giving values), closing invitation and share (celebration only if the goal is reached).
4. **Motion** is subtle and optional: transform/opacity only, GSAP loaded lazily, static under reduced motion, none with Save-Data.
**Consequences:** `GET /api/me/membership`, a cookie-forwarding GET helper on the site, the path added to the service worker's private
list, season/grace in the campaign JSON, a rewrite of `CampaignPage.astro`, brand entries.
