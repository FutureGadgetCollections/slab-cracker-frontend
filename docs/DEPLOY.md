# Deploy + verification runbook

End-to-end path from empty infrastructure to a working scan. Written for someone already familiar with gcloud, BigQuery, and Firebase — no hand-holding on basics.

Cross-repo: this runbook touches `slab-cracker-frontend` (this repo), `slab-cracker-backend`, and the `fg-tcglabs` GCP project / `slab-cracker-auth` Firebase project.

---

## 1. One-time infra

### 1a. Apply BigQuery schemas

Two new tables for the consumer API:

```bash
cd ../slab-cracker-backend
bq query --use_legacy_sql=false --project_id=fg-tcglabs < sql/create_anon_quota.sql
bq query --use_legacy_sql=false --project_id=fg-tcglabs < sql/create_scan_history.sql
```

Verify:

```bash
bq show --schema fg-tcglabs:grading.anon_quota
bq show --schema fg-tcglabs:grading.scan_history
```

### 1b. Firebase project config

Use the existing `slab-cracker-auth` Firebase project.

1. In the Firebase console → **Authentication → Sign-in method**, enable **Google** and (optionally) **Email/Password**.
2. **Authentication → Settings → Authorized domains**: add `gem-hunter.futuregadgetlabs.com` (the custom subdomain this site deploys to). You can leave `futuregadgetcollections.github.io` in the list too as a fallback during DNS propagation.
3. **Project settings → Your apps**: grab the web config. The six values go into backend and frontend env vars.

### 1c. Cloud Run service account permissions

The `slab-cracker-api` service account needs:
- `roles/bigquery.dataEditor` on `fg-tcglabs` (to insert into `anon_quota`, `scan_history`)
- `roles/bigquery.jobUser` on `fg-tcglabs`
- `roles/storage.objectAdmin` on the `slab-cracker-scans` bucket
- **Firebase Admin SDK access** — either add `roles/firebaseauth.admin` on the `slab-cracker-auth` project, or attach a Firebase Admin SDK service account key as a mounted secret (ADC works if the service account has permission).

### 1d. Generate and set the anonymous quota salt

```bash
openssl rand -hex 32
# → paste into Secret Manager as anon-quota-salt
```

---

## 2. Backend local smoke test

### 2a. Env vars

Create `../slab-cracker-backend/.env`:

```bash
GCP_PROJECT=fg-tcglabs
BQ_DATASET=grading
GCS_SCANS_BUCKET=slab-cracker-scans
FIREBASE_PROJECT_ID=slab-cracker-auth
ANON_QUOTA_SALT=<paste the hex from 1d>
PROXY_URL=http://localhost:3001
PROXY_API_KEY=<your proxy key>
PORT=8080
```

Application Default Credentials must be set (`gcloud auth application-default login` once per machine).

### 2b. Run

```bash
cd ../slab-cracker-backend
set -a && source .env && set +a && go run .
```

Log lines to confirm:

```
Firebase auth client ready for project slab-cracker-auth
slab-cracker-api listening on :8080
```

If you see `FIREBASE_PROJECT_ID unset — auth middleware will treat all requests as anonymous`, your env didn't load.

### 2c. Curl the endpoints

Anonymous scan — should succeed once, then 429:

```bash
curl -sX POST http://localhost:8080/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"cert_number":"<real PSA cert>"}'
# → 200 with similarity:null and defects.centering.score
curl -sX POST http://localhost:8080/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"cert_number":"<any>"}'
# → 429 {"error":"daily scan limit reached", ...}
```

History requires auth — expect 401 without a Bearer token:

```bash
curl -i http://localhost:8080/api/scan/history
# → HTTP/1.1 401 Unauthorized
```

To test signed-in history: sign in on the local frontend, open devtools, and
grab `await firebase.auth().currentUser.getIdToken()` — then:

```bash
TOKEN=<paste>
curl -s http://localhost:8080/api/scan/history -H "Authorization: Bearer $TOKEN" | jq
```

### 2d. Inspect BQ side effects

```bash
bq query --use_legacy_sql=false "SELECT * FROM \`fg-tcglabs.grading.anon_quota\` ORDER BY last_scan_at DESC LIMIT 5"
bq query --use_legacy_sql=false "SELECT uid, cert_number, scanned_at FROM \`fg-tcglabs.grading.scan_history\` ORDER BY scanned_at DESC LIMIT 5"
```

---

## 3. Frontend local dev

### 3a. Env vars

```bash
cd ../slab-cracker-frontend
cp .env.example .env
```

Fill in:
- Firebase six-field config from 1b
- `HUGO_PARAMS_BACKENDURL=http://localhost:8080`
- leave the Stripe price IDs blank for now (Phase 3)

### 3b. Run

```bash
set -a && source .env && set +a && hugo server
```

Open `http://localhost:1313/`. Verify:
- Landing renders; "Try it now" links to `/app/`
- Anonymous scan on `/app/` hits your local backend; result card populates
- Sign in with Google from the navbar — badge flips to `Free`, `/account/` renders
- `/account/` loads scan history via `GET /api/scan/history`
- Pricing and FAQ pages render

Browser devtools network tab should show the `Authorization: Bearer` header attached on authenticated calls.

---

## 4. Backend Cloud Run deploy

```bash
cd ../slab-cracker-backend

# Build + push image
gcloud builds submit --tag gcr.io/fg-tcglabs/slab-cracker-api

# Deploy
gcloud run deploy slab-cracker-api \
  --image=gcr.io/fg-tcglabs/slab-cracker-api \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --timeout=60s \
  --memory=1Gi \
  --cpu=1 \
  --set-env-vars=GCP_PROJECT=fg-tcglabs,BQ_DATASET=grading,GCS_SCANS_BUCKET=slab-cracker-scans,FIREBASE_PROJECT_ID=slab-cracker-auth,PROXY_URL=<your proxy url> \
  --set-secrets=ANON_QUOTA_SALT=anon-quota-salt:latest,PROXY_API_KEY=proxy-api-key:latest
```

Note: `--timeout=60s` is tight. The scan endpoint can take 10–20s; if you see
`context deadline exceeded` under real load, bump to `--timeout=120s`. Longer
term this moves behind an async job queue (Phase 4 in `ROADMAP.md`).

Grab the service URL from the deploy output — you'll paste it into the
frontend's GH Actions vars next.

---

## 5. Frontend GH Pages deploy

### 5a. Populate GH Actions settings

In the `slab-cracker-frontend` repo settings → **Secrets and variables → Actions**:

**Variables:**
- `PAGES_BASE_URL` — `https://gem-hunter.futuregadgetlabs.com/` (trailing slash matters for Hugo's baseURL handling). Fallback for the un-custom-domained site is `https://futuregadgetcollections.github.io/slab-cracker-frontend/`.
- `HUGO_PARAMS_FIREBASE_AUTH_DOMAIN`
- `HUGO_PARAMS_FIREBASE_PROJECT_ID`
- `HUGO_PARAMS_FIREBASE_STORAGE_BUCKET`
- `HUGO_PARAMS_BACKENDURL` — the Cloud Run URL from §4
- `HUGO_PARAMS_GCS_DATA_BUCKET=slab-cracker-data`
- `HUGO_PARAMS_GITHUB_DATA_REPO=FutureGadgetCollections/slab-cracker-data`
- Stripe price IDs — leave blank until Phase 3

**Secrets:**
- `HUGO_PARAMS_FIREBASE_API_KEY`
- `HUGO_PARAMS_FIREBASE_APP_ID`
- `HUGO_PARAMS_FIREBASE_MESSAGING_SENDER_ID`
- `HUGO_PARAMS_STRIPE_PUBLISHABLEKEY` — blank until Phase 3

### 5b. Enable Pages

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

Push any commit to `main` (or re-run the existing `Deploy to GitHub Pages` workflow). Deploy runs in ~1 minute.

### 5c. Wire the `gem-hunter.futuregadgetlabs.com` subdomain

The repo already ships a `static/CNAME` file containing `gem-hunter.futuregadgetlabs.com`, so every Hugo build copies it into `public/CNAME` and the Pages deploy picks it up automatically. One-time setup:

1. **DNS** — at the registrar/host for `futuregadgetlabs.com`, add a record:
   - Type: `CNAME`
   - Name: `gem-hunter`
   - Value: `futuregadgetcollections.github.io`
   - TTL: 300 (or whatever the default is)
2. **GitHub Pages** — repo Settings → Pages → **Custom domain** = `gem-hunter.futuregadgetlabs.com`. Tick **Enforce HTTPS** once the Let's Encrypt cert finishes provisioning (takes a few minutes after DNS resolves).
3. **Firebase Authorized domains** — already covered in §1b; make sure `gem-hunter.futuregadgetlabs.com` is in the list before you try signing in on the live site, otherwise the OAuth popup will 400.
4. **Backend CORS** — in `slab-cracker-backend`, add `https://gem-hunter.futuregadgetlabs.com` to the allowed origins list alongside (or replacing) the `*.github.io` entry.

Verifying DNS end-to-end:

```bash
dig +short gem-hunter.futuregadgetlabs.com       # should resolve to a GH Pages A record via the CNAME
curl -I https://gem-hunter.futuregadgetlabs.com/  # 200 OK, x-github-request-id header present
```

### 5c. End-to-end smoke

Hit the deployed site. Anonymous scan on `/app/` should:
1. POST to your Cloud Run URL
2. 200 on first scan of the day, 429 on the second
3. Sign in → navbar flips, `/account/` loads history

If CORS blocks you, the `corsMiddleware` in `main.go` is already `*` — the more
likely culprit is an unreachable backend URL or a Firebase auth domain that
doesn't include GH Pages.

---

## Verification checklist

- [ ] `bq show` confirms both new tables exist
- [ ] `go run .` prints "Firebase auth client ready"
- [ ] Local curl: first anon scan → 200, second → 429 with `retry_after_hours`
- [ ] Local curl: `/api/scan/history` → 401 without token
- [ ] Frontend landing renders locally against the local backend
- [ ] Sign in → `/account/` shows tier badge, history table populates (even if empty)
- [ ] Cloud Run deploy succeeds, service URL responds on `/health`
- [ ] GH Pages build green, deployed site hits Cloud Run successfully

---

## Known issues / caveats

- **Sync response time on /api/scan is 10–20s.** First-time cert scans are worst-case because they include a PSA scrape + proxy fetch + CV run. Cloud Run's default 60s timeout is enough but tight. Phase 4 moves this to an async job queue.
- **`similarity` is always `null`.** The Siamese / contrastive model isn't wired up yet. The frontend shows "pending" in that column.
- **Only centering defect score is real.** Corners / edges / surface are `"unknown"` until those CV stages land.
- **No Stripe integration.** Pricing page's paid CTAs are stubbed; billing portal button toasts a "coming soon" message.
- **Anon quota is IP-based.** Shared IPs rate-limit multiple humans together; VPN rotation bypasses. This is accepted per the `docs/TIERS.md` design — the free-anon tier is a demo, not a moat.
- **First-ever scan of a cert is slow; subsequent scans are fast.** The PSA scrape + fetch only happens once; after that the cert is cataloged and scans live in GCS.
