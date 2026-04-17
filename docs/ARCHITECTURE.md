# Architecture

## Overview

```
                 ┌──────────────────────────────────────────────┐
                 │          Browser (anon or signed-in)         │
                 │  Hugo static site, JS reads Firebase claims  │
                 └──────────────────────────────────────────────┘
                         │                       │
           scan/API calls│                       │payment flows
           Authorization │                       │
           Bearer <token>│                       ▼
                         ▼                ┌────────────────┐
                  ┌──────────────┐        │     Stripe     │
                  │  Backend API │◄───────┤ webhook events │
                  │  (Cloud Run) │        └────────────────┘
                  │              │                │
                  │ 1. Validate  │                │
                  │    ID token  │                │
                  │ 2. Read tier │                ▼
                  │    claim     │        ┌───────────────────┐
                  │ 3. Enforce   │        │  Firebase custom  │
                  │    quota     │        │   claim + BQ      │
                  │ 4. Run op    │        │   subscriptions   │
                  └──────────────┘        └───────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  BigQuery +  │
                  │  GCS + ML    │
                  │  pipeline    │
                  └──────────────┘
```

## Why static

This frontend is a Hugo-generated static site. The decision was considered against Next.js / SvelteKit alternatives.

**Chosen static because:**

- **Hosting cost is $0** on GitHub Pages or Cloudflare Pages. A dynamic runtime would be ~$0–20/mo on Vercel or Cloud Run — not huge, but also not free.
- **The backend does all the work.** Scan analysis, quota enforcement, tier gating, Stripe webhooks — all server-side. The frontend is forms, auth state, and result display. SSR buys nothing here.
- **Consistent with the admin repo** (also Hugo) — one mental model, one deployment pattern, one theme system.
- **No server to babysit on the frontend side.** The only operational surface is the GH Pages deploy.

**Trade-offs accepted:**

- **No SSR for SEO on dynamic pages.** Individual scan result pages are not crawlable. Acceptable — we're selling a tool, not trying to rank "PSA cert 12345678" on Google. Marketing pages (landing, pricing) are SSG'd and fully indexed.
- **Tier-flash on initial load.** Before Firebase resolves auth state, the page briefly shows free-tier UI. Mitigated by a loading skeleton and `visibility: hidden` on tier-gated elements until `onAuthStateChanged` fires.
- **Client-side JS enforces nothing.** Only the backend enforces tier limits. The frontend's tier classes are UX, not security.

## Auth flow

### Anonymous visitor

1. User lands on the site
2. `firebase.auth().onAuthStateChanged` fires with `null`
3. Body gets class `tier-free-anon`, all UI renders for anonymous experience
4. User submits a scan — frontend calls `POST /api/scan` with NO Authorization header
5. Backend sees no header, applies anonymous tier logic:
   - Hash client IP
   - Check `grading.anon_quota` for `(ip_hash, today)` count
   - If >= 1, return HTTP 429
   - Else insert row and run the scan
6. Frontend renders result + ads

### Signed-in user

1. User clicks "Sign in" → Firebase popup (Google or email/password)
2. `onAuthStateChanged` fires with user object
3. Frontend calls `user.getIdTokenResult()` to read claims; extracts `tier`
4. Body gets class `tier-{free|basic|pro}`
5. Authenticated scan: `api("POST", "/api/scan", {cert})` from `static/js/api.js` attaches `Authorization: Bearer <id-token>`
6. Backend validates token via Firebase Admin SDK, reads `tier` claim, enforces feature-specific logic
7. If the operation is tier-gated and the user's tier doesn't permit it, backend returns 403 with a `{upgrade_to: "pro"}` body
8. Frontend shows an in-app upgrade modal

### Post-purchase claim refresh

Stripe webhook delay + Firebase claim propagation can leave a just-upgraded user seeing their old tier for up to an hour if we rely on natural token refresh. To avoid that:

1. After Stripe Checkout redirects back to `/account?checkout=success`
2. Frontend waits ~2s (give webhook a chance), then calls `firebase.auth().currentUser.getIdToken(true)` to force a fresh token
3. Re-read claims, update body class, show confirmation

If the webhook is still pending after the force-refresh, the page polls `/api/me` every 3s for up to 30s and then falls back to "Your upgrade is being processed — refresh in a minute" messaging.

## Tier enforcement

Tier lives in two places, kept in sync by Stripe webhook handlers in the backend:

| Location | Shape | Purpose |
|----------|-------|---------|
| `grading.subscriptions` (BigQuery) | `(firebase_uid, stripe_customer_id, stripe_sub_id, tier, status, current_period_end, updated_at)` | Canonical source of truth. Admin UI reads/writes from here. |
| Firebase custom claim | `{tier: "free" \| "basic" \| "pro"}` | Fast-read mirror. Rides in the ID token; no DB hit per API call. |

**Enforcement is entirely in the backend.** Every API endpoint that touches a gated feature runs:

```python
def require_tier(min_tier: str):
    def decorator(handler):
        def wrapper(request):
            claims = verify_firebase_token(request.headers["Authorization"])
            user_tier = claims.get("tier", "free")
            if TIER_RANK[user_tier] < TIER_RANK[min_tier]:
                return 403, {"upgrade_to": min_tier}
            return handler(request)
        return wrapper
    return decorator
```

(Actual backend code lives in `../slab-cracker-backend` — this is illustrative.)

## Stripe integration

- **Publishable key** lives in `hugo.toml` under `params.stripe.publishableKey` (non-secret, safe for the browser)
- **Secret key** lives only in the backend's environment
- **Checkout** is one JS call: `stripe.redirectToCheckout({lineItems, successUrl, cancelUrl})` using price IDs from `hugo.toml`
- **Customer Portal** is a backend-issued redirect: frontend calls `api("POST", "/api/billing/portal")`, backend creates a portal session, frontend navigates to the returned URL
- **Webhooks** hit the backend at `/webhook/stripe` — see backend repo for the handlers. Events we care about:
  - `checkout.session.completed` — first-time upgrade
  - `customer.subscription.updated` — tier change, status change (active → past_due)
  - `customer.subscription.deleted` — cancellation completed
  - `invoice.payment_failed` — start grace period

## Data reads

Two paths for static data (card catalog, reference lists, public stats):

1. **GitHub Raw** — `raw.githubusercontent.com/FutureGadgetCollections/slab-cracker-data/main/...`
2. **GCS fallback** — `storage.googleapis.com/slab-cracker-data/...`

Handled by `static/js/data-loader.js` (mirror of the admin repo's loader). Writes never go here — they go through the API.

## Ads integration

- Free tiers (anon + signed-in) render an ad slot in the layout
- Controlled by `tier-free-anon` and `tier-free` body classes
- Basic/Pro users have `display: none` on ad slots via CSS scoped to the paid tier classes
- Ad network TBD (Google AdSense is the default path of least resistance)

## Deployment

- **GitHub Actions** on push to `main` → build Hugo → deploy to GH Pages
- Non-secret Hugo params passed as Actions vars; secrets (Firebase API key, Stripe publishable key) as Actions secrets
- Custom domain TBD (likely `slabcracker.com` or similar)

## Security notes

- Firebase API key is **not a secret** — it identifies the project, doesn't authorize anything. Safe in the browser and in committed config.
- Stripe **publishable key is not a secret** either.
- Stripe **secret key**, Firebase Admin SDK credentials, and the webhook signing secret live only on the backend.
- All tier enforcement happens on the backend. The frontend tier classes are strictly UX.
- Never trust `user.customClaims` read client-side for security-critical decisions. Only the backend-verified token claim is authoritative.
