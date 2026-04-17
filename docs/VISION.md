# Vision

## Why this product exists

Graded card collectors pay large premiums for a **PSA 10** over a **PSA 9** — often 3x–10x the price. That gap creates an obvious opportunity: buy a PSA 9 that *looks like* a 10, crack it out of the slab, and resubmit for re-grading. If it comes back a 10, the profit is substantial.

The problem is evaluation. PSA 9s vary wildly in quality. Without a trained eye and reference images, picking good re-submission candidates is guesswork. Most collectors can't do it reliably, and the ones who can spend hours poring over scans manually.

**Slab Cracker automates that evaluation.** Given a PSA 9 cert number, the system fetches the official PSA scans, compares them against a reference set of known PSA 10s using a Siamese / contrastive image model, and produces a similarity score plus a defect breakdown (centering, edges, corners, surface). Collectors get an evidence-backed signal in seconds instead of making a gut call.

## Target user

Three overlapping personas:

1. **Casual collector** — eyes a single card listing on eBay, wants a second opinion before bidding. Uses the free tier once or twice, maybe upgrades to Basic if they stick around.
2. **Serious flipper** — hunts for undergraded 9s daily, resubmits in bulk, tracks ROI. Needs unlimited scans, AI-grade explanations, and export for their own spreadsheets. **This is the Pro target.**
3. **LCS / eBay seller** — scans inventory before listing to price accordingly. Wants portfolio/databasing features. Pro target.

## Success metrics

Leading indicators (product health):

- **Free-tier activation rate** — % of anonymous visitors who complete their 1 daily scan
- **Free → signup conversion** — % of anonymous scanners who create an account within 7 days
- **Signup → paid conversion** — % of signed-in users who upgrade to Basic or Pro within 30 days
- **Scan-to-decision rate** — % of paid users who actually purchase a card they scanned (tracked via regrade pipeline once live)

Lagging indicators (business health):

- **MRR** split by tier
- **Paid churn** (target: <5% monthly for Basic, <3% for Pro)
- **Regrade accuracy** — when users buy → resubmit → get a grade back, did we predict the outcome? This is the product's north-star quality metric. See the regrade tracking memory in the admin repo for the longer-term plan.

## What this product is NOT

- **Not a marketplace.** We don't list or sell cards. We analyze cards users find elsewhere (mostly eBay).
- **Not a grading service.** PSA/BGS grade; we just predict what they *might* grade.
- **Not an admin tool.** The internal ops UI for curating reference scans and reviewing the ML pipeline lives in `slab-cracker-frontend-admin`. This repo is purely consumer-facing.

## Product principles

1. **Server enforces, client hints.** Tier gating is never done in JS. The frontend can show or hide UI for UX, but all enforcement is backend.
2. **Free tier is a genuine demo, not a tease.** One full scan per day with real output — not a blurred result behind a paywall. We want users to leave the free tier knowing what the paid product does.
3. **Ads only on free tiers.** Any paying customer (Basic or above) sees zero ads.
4. **Pro is for power users.** AI narrative analysis, batch operations, API access, data export — if it smells like a tool for flippers, it goes in Pro.
5. **No scan without consent.** Free-no-signup users get a disclosure that their IP is used to enforce the daily quota.

## Open questions

- **Pricing** is TBD. Ballpark plan: Basic ~$5–10/mo, Pro ~$20–30/mo, annual discount available. Needs competitor research (joshbeetcg, PSA Photograde, etc.).
- **Ad network** — simple banner ads via Google AdSense, or something more collectible-hobby adjacent?
- **Trial period** — does Basic/Pro get a 7-day free trial, or does the free-with-account tier *serve* as the trial indefinitely?
