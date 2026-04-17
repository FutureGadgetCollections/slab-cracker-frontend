# slab-cracker-frontend

## Project Overview

Hugo-based **public-facing consumer frontend** for Slab Cracker — subscription-gated PSA cert analysis. Deployed to GitHub Pages; reads static JSON from the data repo and writes/scans via the backend API, which enforces tier-based access.

**This repo supersedes `slab-cracker-frontend-public`** (a deprecated read-only results viewer). The admin UI in `slab-cracker-frontend-admin` is a separate, internal-only tool.

## Mission

Deliver a consumer-grade web app where:

- Anonymous users can try 1 scan per day (ad-supported) to experience the product
- Logged-in users get unlimited scans with a reduced premium-feature set
- Paying subscribers (Basic / Pro) unlock the full analysis, AI explanations, and data export

The full tier matrix and feature breakdown live in [`docs/TIERS.md`](docs/TIERS.md).

## Multi-Repo Setup

This is one of four sibling repos. Clone all siblings via the admin repo's `./setup.sh`.

| Repo | Local Path | Purpose |
|------|-----------|---------|
| Frontend (this repo) | `.` | Consumer-facing site with tier gating |
| Admin frontend | `../slab-cracker-frontend-admin` | Internal ops UI (allowlisted emails only) |
| Backend | `../slab-cracker-backend` | API + ML pipeline + Cloud Run jobs; enforces all tier logic |
| Data | `../slab-cracker-data` | Static JSON published by backend |
| ~~Public frontend~~ | `../slab-cracker-frontend-public` | **Deprecated** — superseded by this repo |

## Tech Stack

- **[Hugo](https://gohugo.io/)** — static site generator, Go templates
- **Bootstrap 5** — UI framework (theme lives in `themes/public/`, TBD)
- **Firebase Auth** — Google + email/password sign-in; ID tokens attached to all authenticated API calls
- **Stripe** — subscriptions, Customer Portal for self-serve account management
- **GitHub Pages** — static hosting via `.github/workflows/deploy.yml`
- **Backend API** — all tier gating enforced server-side; frontend only *hints* at gating in UI

## Tier Gating Architecture

Tier enforcement is **server-side only**. The frontend is static — it cannot be the security boundary.

```
Browser (anon or signed-in)
  |
  +-- Scan request --> Backend API
                        |
                        1. Resolve tier:
                           - No token?            -> "anon" tier (1 scan/day by IP)
                           - Token present?       -> read custom claim `tier` on Firebase user
                        2. Check & decrement quota (BigQuery row)
                        3. If tier allows feature -> run the operation
                        4. Return result; frontend renders
```

- Stripe webhooks update a BigQuery `subscriptions` table AND set a Firebase custom claim on the user (`tier: free|basic|pro`)
- Custom claims are fast to read and ride inside the ID token, so the backend does not need a DB hit on every request
- The static site reads the claim from the ID token to toggle UI (show "Upgrade" CTAs vs. hiding them) — this is UX, not security

Full flow: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Key Files (Planned)

Repo is currently docs-only. Planned structure mirrors the admin repo:

| Path | Purpose |
|------|---------|
| `hugo.toml` | Hugo config; `params.backendURL`, `params.stripePublishableKey` |
| `themes/public/layouts/` | Hugo templates (marketing pages, pricing, app shell) |
| `static/js/firebase-init.js` | Firebase app init + sign-in helpers |
| `static/js/api.js` | Authenticated `api(method, path, body)` helper |
| `static/js/tier.js` | Reads tier from ID token claim, toggles `.tier-{free,basic,pro}` classes |
| `static/js/stripe.js` | Stripe Checkout + Customer Portal redirects |
| `static/js/data-loader.js` | GitHub-first, GCS-fallback static data fetching |
| `content/` | Hugo content (pricing, landing, /app, /account) |
| `.env.example` | Template for Firebase + Stripe + backend env vars |

## Auth Flow

1. Anonymous visitor can run 1 scan/day (IP-tracked by backend) — shows ads
2. Sign up via Firebase Auth (Google or email/password) — unlocks unlimited scans
3. Upgrade via Stripe Checkout — backend webhook updates Firebase custom claim `tier`
4. ID token now carries the tier; every authenticated API call is gated server-side by the claim
5. Customer Portal handles upgrades, downgrades, cancellations

**Never hardcode Firebase or Stripe secrets.** Publishable keys are safe in the browser; secrets live only on the backend.

## Cross-Repo Coordination Rules

1. **New tier-gated feature:** add the gate in the backend AND toggle the UI here based on the tier claim. Document in `docs/TIERS.md`.
2. **New Stripe price:** update the Stripe product, the backend webhook handler, and the pricing page copy here.
3. **Claim shape change:** coordinate with the backend so the ID token claim structure stays compatible.
4. **Public data change:** if the shape of data coming from `slab-cracker-data` changes, update this frontend to match.
5. **Never hardcode Firebase credentials** — use env vars injected as `HUGO_PARAMS_*`.
6. **Commit separately in each affected repo** with linked messages.

## Documentation

- [`docs/VISION.md`](docs/VISION.md) — why this product exists, target user, success metrics
- [`docs/TIERS.md`](docs/TIERS.md) — subscription tier matrix, gating decisions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — static + API architecture, auth, Stripe
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased delivery

## Development Notes (once scaffolded)

- Hugo config in `hugo.toml`
- Firebase and Stripe publishable keys injected via `HUGO_PARAMS_*` env vars
- Dev server: `set -a && source .env && set +a && hugo server`
- Stripe webhooks run locally via `stripe listen --forward-to localhost:8080/webhook/stripe` during dev
