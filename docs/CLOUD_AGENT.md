# Cursor Cloud Agent setup

How to configure cloud agents for **real Firebase** (`ttf-restaurant-dev`) — same auth as `app.dev` and your Mac `web/.env.local`.

## Cursor: Environment variables vs Runtime Secrets

Per [Cursor security docs](https://cursor.com/docs/cloud-agent/security-network):

| Cursor type | Agent can read value? | Use for |
|-------------|----------------------|---------|
| **Environment Variable** | **Yes** (visible in chat/tools/commits) | Non-sensitive config: URLs, pilot city, CORS |
| **Runtime Secret** | **No** (`[REDACTED]` in agent output) | API keys, PATs, Firebase keys, SA JSON, passwords |
| **Build Secret** | No (build only) | Private npm registries in Dockerfile |

Runtime Secrets are still injected as environment variables — `docker compose`, Vite, and bootstrap work normally; the agent just cannot echo them.

**Do not paste your full `.env` into visible Environment Variables.**

---

## Setup (real Firebase)

### 1. Environment Variables (visible)

Copy [`.env.cloud.visible.example`](../.env.cloud.visible.example) into **Cursor → Cloud Agents → Environment variables**.

### 2. Runtime Secrets (one row per key)

In **Cursor → Cloud Agents → Secrets**, add each as type **Runtime Secret**. Values from your Mac `.env`, `web/.env.local`, and `firebase-sa.json`:

| Runtime Secret name | Source on your Mac |
|---------------------|-------------------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | `.env` |
| `MAPS_API_KEY` | `.env` |
| `GEMINI_API_KEY` | `.env` |
| `VITE_FIREBASE_API_KEY` | `web/.env.local` |
| `VITE_FIREBASE_APP_ID` | `web/.env.local` |
| `VITE_GOOGLE_MAPS_API_KEY` | `web/.env.local` |
| `AUTH_DEV_ADMIN_UIDS` | `.env` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | one-line JSON from `firebase-sa.json` (see below) |
| `DEV_TEST_EMAIL` | optional — browser tests on `app.dev` |
| `DEV_TEST_PASSWORD` | optional |

One-line Firebase admin SA:

```bash
python3 -c "import json; print(json.dumps(json.load(open('firebase-sa.json'))))"
```

Paste output as `FIREBASE_SERVICE_ACCOUNT_JSON` Runtime Secret. Bootstrap writes it to `firebase-sa.json` on the VM so the API can verify real Firebase JWTs.

### 3. Maps keys (required for `/map`)

```bash
gcloud secrets versions access latest --secret=ttf-maps-api-key --project=ttf-restaurant-dev
gcloud secrets versions access latest --secret=ttf-maps-web-api-key --project=ttf-restaurant-dev
```

→ `MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` Runtime Secrets.

### 4. Restart cloud agent

Startup runs `.cursor/scripts/bootstrap-cloud-env.sh` then Docker.

---

## Local stack on the cloud VM

```bash
bash .cursor/scripts/cloud-eval-up.sh   # postgres + API (real Firebase JWT verify)
cd web && npm run dev                   # http://localhost:5173
./scripts/audit-env.sh                  # redacted status report
```

Sign in with a **real** Firebase user on `ttf-restaurant-dev` (same as `app.dev`), or set `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` Runtime Secrets.

---

## Mac helper: split your local env

```bash
./scripts/merge-env-for-cursor.sh
```

Writes:

- `.env.cursor-visible` → copy into Cursor **Environment variables**
- `.env.cursor-runtime-checklist` → names to add as **Runtime Secrets** (no values)

---

## Emulator mode (optional alternative)

Only if you explicitly want fake auth without `firebase-sa.json`:

- Add visible: `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099`, `VITE_USE_AUTH_EMULATOR=true`
- Use `docker compose --profile emulator up …`
- See [WEB_AUTH.md](WEB_AUTH.md#option-b--firebase-auth-emulator-optional-no-secrets)

**Default for this project: real Firebase** (matches production dev pilot).

---

## Deployed `app.dev`

Local Cursor config does not fix a broken `app.dev` deploy. Maps on `app.dev` come from GCP Secret Manager at **web build** time (`ttf-maps-web-api-key`). Re-run the **Web** GitHub workflow after updating that secret.

See [SECRETS_MATRIX.md](SECRETS_MATRIX.md) for rotation and where each secret lives.
