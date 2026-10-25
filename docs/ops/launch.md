# Launch day — a step-by-step for Joël

The site is built to be **closed** (noindex, robots disallow everything, a ribbon says « pas encore référencé ») until
you decide. Launching is one variable and one deploy. Nothing here is done for you: it is your decision and your action.

## 0. Decide the address first
Search engines remember the address they first see. Today the site is on `eec-nkolndongo1.joelfah2003.workers.dev`.
- **Launch on workers.dev now:** nothing to wait for. If a domain comes later, we redirect (301) the old address to the new
  one and ask Google to move (Search Console « changement d'adresse »): it works, but ranking restarts partly.
- **Wait for a domain:** the first impression is on the final address, no redirects, no lost ranking. The cost is waiting.
The domain stays on hold unless you say otherwise.

## 1. Pre-flight (all must be true)
- [ ] `pnpm content:pending` (against production, from `prod-shell.sh`): nothing left for the launch-critical items. Or open
      **À valider** in the admin: empty for service times, address, phones, giving numbers.
- [ ] The **privacy policy** and **legal notice** are *published* (Documents légaux), not drafts; someone competent reviewed them
      (`docs/legal/data-protection.md` says « not legal advice »).
- [ ] Photos: real, consented parish photos, or the approved Pexels placeholders only (no photo of people without consent).
- [ ] People shown by name (council, group leaders, preachers) have their **consent recorded**.
- [ ] A **fresh backup**: Admin → Santé shows the last backup < 9 days (run the `backup` workflow by hand if not).
- [ ] Santé is green; the Rôles screen shows the right people with the right roles (including « Validateur de contenu »).
- [ ] The share cards look right (`/og/default-fr.jpg`, `/og/news-fr.jpg` …) and a news post previews well in WhatsApp (send
      yourself a link).
- [ ] `node scripts/jsonld-check.ts https://<your address>` says « all good », then the **Rich Results Test**
      (https://search.google.com/test/rich-results) on the home, a news post, an event: no errors.

## 2. Launch
1. GitHub → Settings → Secrets and variables → **Variables** → set `SITE_INDEXABLE` = `1`.
2. Actions → `deploy` → **Run workflow** (or merge anything to `main`).
3. Verify on the live address:
   - `/robots.txt` says `Allow: /` and lists `sitemap.xml` (it said `Disallow: /` before);
   - view-source of any page: **no** `<meta name="robots" content="noindex…">`; the grey ribbon is gone;
   - `/sitemap.xml` lists the pages, news posts, events, guides and group pages in both languages;
   - the admin is still noindex (it always is).

## 3. Tell the search engines
- **Google Search Console** → add property → *URL prefix* → your address → verify with the **HTML file** method: download the file Google gives you,
  put it in `apps/web/public/` (same name), commit and deploy; then Verify → Sitemaps → `sitemap.xml`.
- **Bing Webmaster Tools** → add the site (you can import from Search Console) → submit `sitemap.xml`.
Indexing takes days to weeks. Nothing to do but wait.

## 4. Announce
Share the home link on WhatsApp / Facebook. The card shows the parish name and the brand: it comes from `/og/…`. For a single
news post, share its own link (it uses the post's cover as the card).

## 5. If something is wrong — roll back
Set `SITE_INDEXABLE` = `0` and run `deploy` again: noindex returns, robots disallows. Search engines drop pages in days.
A bad deploy: Cloudflare → Workers → `eec-nkolndongo1` → Deployments → previous version → Rollback.

## After launch
- Visit counts: see « Visit counts » in `runbook.md` (switch on once, with the Cloudflare dashboard).
- Check Admin → Santé weekly for the first month; check Search Console « Pages » after a week for errors.
