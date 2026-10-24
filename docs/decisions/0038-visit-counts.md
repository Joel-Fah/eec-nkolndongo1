# 0038 — Visit counts without tracking (Workers Analytics Engine), off until enabled
**Status:** Accepted · 2026-10-22 (Analytics Engine enabled by Joël the same day; dataset `analytics_events`; counting starts with the next production deploy)
**Context:** The parish would like to know which pages are read. We use no cookies, no third-party script and no client
beacon (decision 0017 and the privacy policy). Cloudflare's Workers Analytics Engine can store small data points written by
the Worker itself. Cloudflare's pricing page lists a Free allowance (100 000 data points written and 10 000 queries a day,
3 months' retention); I could only reach a preview copy of that page, so **enabling it in the dashboard is confirmed by Joël
before any deploy carries the binding** (a binding to a service the account has not enabled fails the deploy).
**Decision:**
1. The Worker writes one data point per page view it serves: index = the day (UTC), blobs = path, language, device class
   (mobile or desktop), double = 1. **Nothing else**: no cookie, no IP address, no user agent (read once to skip robots
   and tell mobile from desktop, then dropped), no identifier. Two visits by one person cannot be linked.
2. Skipped: non-GET, non-200, non-HTML, the admin, `/api`, `/media`, the design guide, previews, prefetches, robots,
   `DNT: 1` and `Sec-GPC: 1`, and any path that is not a plain lowercase address.
3. Pages served as static files never reach the Worker, so they are **not counted** (the home page is the main one). We
   say so on the admin screen. Routing the home through the Worker (`run_worker_first`) would count it at the cost of one
   Worker invocation per visit; not done, to decide with the first real readings.
4. The binding exists only when `apps/web/deploy.json` names the dataset (`analyticsDataset`, `accountId`); `assemble-site.ts`
   then adds it. Reading the counts needs a Cloudflare API token with « Account Analytics: Read » as the Worker secret
   `CF_ANALYTICS_TOKEN`. Without these, the admin says « pas encore activé » and nothing is counted.
5. The admin shows 30 days: visits per day by language, most read pages, phone vs computer. Aggregates only.
**Consequences:** If Analytics Engine turns out to need a paid plan, we leave the code dormant and say so: no third-party
analytics, no client beacon. Data lives 3 months at Cloudflare. `docs/legal/data-protection.md` lists it.
