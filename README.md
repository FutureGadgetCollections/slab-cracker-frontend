# slab-cracker-frontend

Public-facing consumer frontend for **Slab Cracker** — identify high-quality PSA 9 graded cards that are strong candidates for re-submission to achieve a PSA 10.

> This is the consumer product. The sibling `slab-cracker-frontend-admin` is an internal ops/admin UI. The older `slab-cracker-frontend-public` (read-only results viewer) is **superseded** by this repo.

## What users get

Users submit a PSA cert number, and Slab Cracker:

1. Fetches the official PSA certification scans (front/back)
2. Compares them to reference PSA 10 / BGS Black Label scans using ML
3. Scores the card's likelihood of upgrading to a PSA 10
4. Breaks down probable defects (centering, edges, corners, surface)
5. (Paid tiers) Provides AI-generated analysis, historical trends, and portfolio tracking

## Subscription tiers (at a glance)

| Tier | Scans | Premium features | Ads | AI / Data |
|------|-------|------------------|-----|-----------|
| **Free (no signup)** | 1 / day | — | Yes | — |
| **Free (account)** | Unlimited | Limited | Yes | — |
| **Basic** | Unlimited | Full | No | — |
| **Pro** | Unlimited | Full | No | Yes |

Full details in [`docs/TIERS.md`](docs/TIERS.md).

## Tech stack

- **[Hugo](https://gohugo.io/)** — static site generator (Go templates, Bootstrap 5)
- **Firebase Auth** — Google sign-in + email/password, issues ID tokens
- **Stripe** — subscription billing, Customer Portal for self-serve upgrades/cancels
- **GitHub Pages** — hosting (deployed via GitHub Actions)
- **Backend API** — `slab-cracker-api` (Cloud Run) enforces all tier gating; the static frontend only hints at what is gated

Why static? See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#why-static).

## Multi-repo setup

Part of a four-repo project. All repos sit as siblings:

```
FutureGadgetCollections/
  slab-cracker-frontend/          <-- THIS repo (public consumer site)
  slab-cracker-frontend-admin/    <-- Internal admin UI
  slab-cracker-backend/           <-- API + ML pipeline + Cloud Run jobs
  slab-cracker-data/              <-- Static JSON published by backend
  slab-cracker-frontend-public/   <-- DEPRECATED — superseded by this repo
```

Clone all siblings via the admin repo's `./setup.sh`.

## Local development

Not yet scaffolded — see [`docs/ROADMAP.md`](docs/ROADMAP.md) for phased delivery. Once the Hugo skeleton lands, dev flow will mirror the admin repo:

```bash
cp .env.example .env
# fill in Firebase + Stripe publishable keys + backend URL
set -a && source .env && set +a && hugo server
```

## Documentation

- [`docs/VISION.md`](docs/VISION.md) — product vision, target user, success metrics
- [`docs/TIERS.md`](docs/TIERS.md) — subscription tiers, feature matrix, gating strategy
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — static site + API gating, auth flow, Stripe integration
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased delivery plan

## License

GPL-3.0 — see [`LICENSE`](LICENSE).
