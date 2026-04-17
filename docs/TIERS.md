# Subscription Tiers

Four tiers. Server-enforced. Pricing TBD.

## Tier summary

| | **Free (no signup)** | **Free (account)** | **Basic** | **Pro** |
|---|---|---|---|---|
| **Price** | $0 | $0 | TBD ($5–10/mo) | TBD ($20–30/mo) |
| **Sign-in required** | No | Yes | Yes | Yes |
| **Scans / day** | **1** | Unlimited | Unlimited | Unlimited |
| **Core scan output** (similarity score, basic defect flags) | ✅ | ✅ | ✅ | ✅ |
| **Ads shown** | ✅ | ✅ | ❌ | ❌ |
| **Premium features** (see below) | ❌ | **Limited** | **Full** | **Full** |
| **AI features** (see below) | ❌ | ❌ | ❌ | ✅ |
| **Databasing features** (see below) | ❌ | ❌ | ❌ | ✅ |

---

## Tier details

### Free (no signup)

The public demo tier. Anyone can land on the site and run **one scan per day**, no account required, no payment info.

- Quota enforced by the backend on `(ip, day)` — see [Anonymous quota enforcement](#anonymous-quota-enforcement)
- Ads displayed throughout the app
- After the daily scan is used, the scan form is replaced with "Sign up to keep scanning" CTA
- All output shown in full (we don't blur or paywall the result of the one scan) — the goal is for the user to *see* what the product does and want more

**Why:** zero-friction acquisition. A collector seeing an eBay listing should be able to drop the cert number in and see a result within seconds of first visiting the site.

### Free (account)

Sign up with a Firebase account (Google or email/password). Unlocks **unlimited scans** but with a reduced premium-feature set and continued ads.

- All "Limited" premium features (see below)
- Ads still shown
- Meant as the indefinite free tier that converts to paid — users can live here forever if they want

**Why:** the sign-up gate is the biggest conversion step; once we have an email and a Firebase UID, upgrading them to Basic/Pro is much easier.

### Basic (paid)

Unlimited scans, **full** premium features, zero ads. Does NOT include AI or databasing features.

- Everything in Free (account)
- Full premium feature set (see below)
- No ads anywhere in the app
- Standard support

**Why:** the natural upgrade from Free (account) — users who are actively using the product weekly and want the ads gone and the advanced features unlocked.

### Pro (paid)

Everything in Basic, plus **AI features** and **databasing features**.

- Everything in Basic
- AI features (see below)
- Databasing features (see below)
- Priority support

**Why:** targets the power user — flippers, resellers, LCS owners who run dozens of scans per week and need tooling around the scans, not just the scans themselves.

---

## Feature definitions

> These are placeholders for the initial launch. The specific features in each column will evolve — what matters architecturally is which **tier** a feature falls into.

### Premium features

Free (account) gets a **limited** subset (marked `[Basic+]` below means Free-account does NOT get it). Basic and above get all of these.

**Available to Free (account):**
- Save scan history (up to 25 most recent scans)
- Basic defect breakdown (centering / edges / corners / surface)
- Similarity score against reference set
- Share a scan result via public link

**Basic+ only:**
- `[Basic+]` Unlimited scan history retention
- `[Basic+]` Side-by-side comparison against specific reference PSA 10s
- `[Basic+]` Higher-resolution scan download
- `[Basic+]` Detailed per-region defect heatmap overlay
- `[Basic+]` Watchlist: get notified when a matching card appears in feeds
- `[Basic+]` Batch scan (up to 10 cert numbers at once)

### AI features (Pro only)

- **AI narrative analysis** — LLM-generated natural-language explanation of why a card is or isn't a good re-submission candidate ("The top-right corner shows slight whitening that likely caps this at a 9.5...")
- **Natural-language query** — "Show me Charizards with similarity >0.8 and centering score >90"
- **Re-submission probability** — calibrated probability that a resubmit will upgrade, based on historical outcomes once the regrade pipeline is feeding data back
- **Price prediction** — expected sale price after regrade, cross-referenced with market tracker data

### Databasing features (Pro only)

- **Portfolio tracking** — register cards you own, track them through scan → purchase → regrade → sale
- **CSV / JSON bulk export** of your scan history, portfolio, and watchlist
- **Read-only API access** — programmatic scan history for users who want to build on top of their data
- **Historical trend dashboards** — your scan outcomes over time, grade distribution, ROI curves
- **Cross-reference with market prices** — via the already-wired join to `future-gadget-labs-483502.catalog`

---

## Gating strategy

### Source of truth

A user's tier lives in **two places**, written by Stripe webhooks:

1. **BigQuery** `grading.subscriptions` — `(firebase_uid, stripe_customer_id, tier, status, current_period_end)`. Canonical.
2. **Firebase custom claim** `tier: "free" | "basic" | "pro"` on the user record. Cached mirror of the BQ row, rides inside the ID token for zero-DB-hit tier checks on every API call.

The admin UI (`slab-cracker-frontend-admin`) can inspect/override subscriptions in BigQuery directly; the Stripe webhook is the only writer in normal operation.

### Anonymous tier

No account = no Firebase UID. Enforced by the backend on `(ip_hash, date)` in a `grading.anon_quota` table. Rate limit is returned via HTTP 429 with an `X-Quota-Reset` header, and the frontend shows a "You've used today's free scan — sign up for unlimited" CTA.

**Known limitations of IP-based quotas:**

- Shared IPs (office, cafe, university) rate-limit multiple people together — fine, we accept this
- VPN/mobile-network rotation lets determined users bypass — fine, we accept this too; the free tier is a demo, not a moat
- If abuse gets bad, add a CAPTCHA before the scan; never go to browser fingerprinting (privacy reasons)

### Client-side UI hints

The frontend reads `tier` from the ID token claim and toggles body classes `tier-free-anon`, `tier-free`, `tier-basic`, `tier-pro`. Templates can show/hide feature CTAs based on these classes. Example:

```html
<div class="feature-ai-analysis" data-requires-tier="pro">
  <!-- pro-only content -->
</div>
<div class="upgrade-cta" data-hide-for-tier="pro">
  Upgrade to Pro to unlock AI analysis
</div>
```

**This is UX, not security.** A user who manually edits the DOM to reveal Pro-only UI will hit the backend and get a 403 — the tier check on the API is the only thing that matters.

### Stripe integration

- **Checkout:** `stripe.redirectToCheckout()` from the pricing page, redirecting back to `/account?checkout=success`
- **Customer Portal:** `stripe.billingPortal.sessions.create()` on the backend, redirect user to manage card / cancel / switch plans
- **Webhooks:** backend handles `customer.subscription.created`, `.updated`, `.deleted`, `invoice.payment_failed`. Each updates BigQuery + refreshes the Firebase custom claim. The user's next ID token refresh picks up the new tier.
- **Tier refresh latency:** custom claim propagation can take up to 1 hour on the token refresh cycle. If a user just upgraded and the UI still shows Basic, we explicitly `user.getIdToken(true)` to force-refresh after the Stripe redirect completes.

---

## Open design questions

- **Trial period for Basic/Pro?** Or does Free (account) already serve that purpose?
- **Annual pricing** — flat 2-month discount? 20%? Stripe supports both.
- **Grace period on failed payment** — 7 days? 14 days? During grace, downgrade to Free (account) with a banner, don't immediately strip access.
- **Do we ever let Basic users run one AI scan** as a paid taste, or keep the Basic/Pro wall hard?
- **What counts as a "scan"?** A cert number submission? A re-analysis of an already-scanned cert? The batch endpoint — 10 scans or 1 batch?
