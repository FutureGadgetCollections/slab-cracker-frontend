# Roadmap

Phased delivery. Each phase is shippable — no half-built tiers in production.

## Phase 0 — Design (current)

- [x] Create repo
- [x] Documentation: vision, tiers, architecture
- [ ] Brand / naming decisions (domain, logo, palette)
- [ ] Pricing finalized
- [ ] Ad network chosen

## Phase 1 — Marketing site + free tier (no signup)

Goal: ship a landing page and the 1-scan-per-day anon tier. No login, no Stripe yet.

- [x] Hugo scaffold (`themes/public/`, matching admin repo's patterns)
- [x] Landing page, pricing page (as teaser — "Coming soon" on paid CTAs), FAQ
- [x] `/app` route — single scan form (wired to backend; awaits `POST /api/scan`)
- [x] Ad slot in layout (placeholder, real ads in Phase 4)
- [x] `data-loader.js` + `api.js` ported from admin repo
- [x] Tier-class toggling on body (`tier.js`) — server-enforced gating shows through as UX
- [x] Stub privacy + terms pages
- [x] `.github/workflows/deploy.yml` GH Pages deploy (needs Actions vars/secrets populated before it'll work)
- [ ] Backend endpoint `POST /api/scan` with anonymous quota logic (IP-based `grading.anon_quota` table) — **lives in slab-cracker-backend, not this repo**
- [ ] Populate GH Actions `PAGES_BASE_URL` + Firebase / backend vars + secrets
- [ ] Custom domain decision + DNS
- [ ] Analytics (plausible or GA4)

Exit criteria: anyone can land, run one scan, see the result, be blocked on the second.

## Phase 2 — Firebase Auth + free (account) tier

Goal: ship sign-up, unlimited scans for signed-in users, persisted scan history.

- [ ] Firebase Auth integration (Google + email/password)
- [ ] Sign-in / sign-up / account pages
- [ ] `static/js/firebase-init.js`, `tier.js`
- [ ] Backend `/api/scan` reads `tier: "free"` claim, removes the daily quota, keeps ads
- [ ] `grading.scan_history` table; user-scoped scan history page
- [ ] Default Firebase custom claim `tier: "free"` set on user creation
- [ ] Share-a-scan public link functionality

Exit criteria: user can sign up, run unlimited scans, see history, share a scan. Still sees ads.

## Phase 3 — Stripe + Basic tier

Goal: ship paid Basic, no-ads, full premium features.

- [ ] Stripe account + products configured
- [ ] Backend webhook handler (`POST /webhook/stripe`) updating BigQuery + Firebase custom claims
- [ ] `grading.subscriptions` table
- [ ] Pricing page wired to Stripe Checkout
- [ ] `/account` Customer Portal redirect
- [ ] Basic-tier feature gates on backend endpoints (comparison, batch scan up to 10, heatmap, hi-res download, watchlist backend)
- [ ] Frontend tier-class toggling (`.tier-basic` hides ads, reveals Basic features)
- [ ] Post-checkout flow with forced ID token refresh
- [ ] Failed-payment grace period logic
- [ ] Cancel flow (stay active until period end, downgrade on period close)

Exit criteria: user can upgrade to Basic via Stripe, ads disappear, premium features unlock, they can cancel from their account page.

## Phase 4 — Pro tier: AI + databasing

Goal: ship Pro — the power-user tier.

**AI features:**
- [ ] Backend `POST /api/scan/explain` — LLM narrative analysis, Pro-gated
- [ ] Natural-language query endpoint (Pro-gated)
- [ ] Re-submission probability model — initially heuristic, later calibrated once regrade data comes in
- [ ] Price prediction — join to market tracker data, surface expected post-regrade value

**Databasing features:**
- [ ] Portfolio CRUD: register owned cards, track status (scanned / purchased / submitted / graded / sold)
- [ ] CSV + JSON export for scan history, portfolio, watchlist
- [ ] Read-only API: API key issuance from account page, rate-limited endpoints for programmatic scan history
- [ ] Historical trend dashboards (per-user grade distribution, scan outcomes over time, ROI curves)

**Infra:**
- [ ] Real ads integrated on Free tiers (AdSense or alternative)
- [ ] Annual pricing option in Stripe (with 2-month discount)

Exit criteria: Pro tier fully unlocks AI + data features. Free tier has real ads. Annual plans available.

## Phase 5 — Post-launch quality

- [ ] Regrade outcome tracking — close the loop on users who purchase → submit → receive a grade back
- [ ] Prediction accuracy dashboard (internal, possibly a Pro feature later)
- [ ] Referral program
- [ ] Affiliate program for card content creators
- [ ] Mobile PWA polish (add-to-home-screen, offline result view)
- [ ] Integration with `ebay-alert-script` — "one-click scan from an alert email"

## Explicitly NOT in scope (for now)

- Native mobile apps
- Grading service competition (we analyze, we don't grade)
- Buying/selling marketplace
- Social features (feeds, follows, leaderboards)
- Supporting non-PSA grading companies on the consumer site — Phase 6+ if ever
