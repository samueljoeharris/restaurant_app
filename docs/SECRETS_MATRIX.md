# Secrets & environment matrix

**Write secrets once in GCP Secret Manager.** Dev machines and CI pull from there — no copy-paste into `.env`, Cursor UI, or GitHub Secrets (except one-time bootstrap).

Never commit filled `.env`, `web/.env.local`, `.secrets/`, or `firebase-sa.json`.

**Canonical source of truth:** [`infra/terraform/modules/secrets/catalog.tf`](../infra/terraform/modules/secrets/catalog.tf) — every secret has labels (`category`, `environment`, `sync_dev`) and annotations (`title`, `purpose`, `env-alias`, `seed-hint`).

## Mental model

```
You → GCP Secret Manager (source of truth)
         ├── Cloud Run (Terraform secret_env / file mounts)
         ├── GitHub Actions (WIF → gcloud secrets access)
         └── ./scripts/sync-secrets.sh → .secrets/ (gitignored)
                  ├── Cursor Cloud VM (primary dev)
                  └── Local Mac (gcloud ADC)
```

## Secret inventory

| SM secret ID | Env alias | Category | Purpose | Dev sync? |
|--------------|-----------|----------|---------|-----------|
| `ttf-maps-api-key` | `MAPS_API_KEY` | api | Server Places/Geocoding | yes |
| `ttf-maps-web-api-key` | `VITE_GOOGLE_MAPS_API_KEY` | web | Browser Maps JS API | yes |
| `ttf-firebase-web-env` | `web/.env.local` VITE_* | web | Firebase web SDK JSON | yes |
| `ttf-firebase-admin-sa` | `firebase-sa.json` | api | API JWT verify | yes |
| `ttf-gemini-api-key` | `GEMINI_API_KEY` | api | Review chat | yes |
| `ttf-github-pat-mcp` | `GITHUB_PERSONAL_ACCESS_TOKEN` | dev-tool | Cursor GitHub MCP | yes |
| `ttf-dev-test-credentials` | `DEV_TEST_*` | dev-tool | Optional browser tests | yes |
| `ttf-apple-sign-in-key` | `APPLE_*` / `APPLE_SIGN_IN_KEY_JSON` | api | Apple revoke on delete | yes |
| `ttf-recaptcha-site-key` | `VITE_APP_CHECK_RECAPTCHA_SITE_KEY` | web | App Check (optional local) | yes |
| `ttf-iap-oauth` | Terraform IAP vars | terraform | Admin IAP OAuth | no |
| `ttf-db-url` | `DATABASE_URL` | infra | Cloud SQL DSN | no |
| `ttf-internal-job-secret` | `INTERNAL_JOB_SECRET` | infra | Scheduler job token | no |
| `ttf-api-public-url` | api origin | infra | CI deploy URL | no |
| `ttf-web-public-url` | app origin | infra | CI deploy URL | no |
| `ttf-admin-public-url` | admin origin | infra | CI deploy URL | no |

Non-secrets: [`.env.defaults`](../.env.defaults) (committed).

### View in GCP Console or CLI

Terraform labels every secret with `managed_by=terraform`. In Console, open a secret → **Labels** and **Annotations** show title, purpose, env alias, and seed instructions.

```bash
./scripts/list-sm-secrets.sh
gcloud secrets describe ttf-maps-api-key --project=ttf-restaurant-dev
```

## Write a secret (once)

```bash
PROJECT=ttf-restaurant-dev
echo -n "VALUE" | gcloud secrets versions add SECRET_ID --project=$PROJECT --data-file=-
```

Secret **containers** are created by Terraform (`catalog.tf` + environment `secret_ids`). Do not `gcloud secrets create` manually — add new IDs to the catalog first.

Optional dev placeholders: Terraform can seed initial JSON for `ttf-dev-test-credentials` and `ttf-apple-sign-in-key` when `create_placeholders = true` (dev only). Replace with real values via `gcloud secrets versions add`.

## Pull secrets (dev)

### Cursor Cloud (primary)

1. **Environment variables:** copy [`.env.cloud.visible.example`](../.env.cloud.visible.example)
2. **One Runtime Secret:** `GCP_DEV_SYNC_SA_JSON` = dev-sync SA JSON key
3. Agent boot runs `sync-secrets.sh` automatically

Create the SA key after Terraform apply:

```bash
./scripts/create-dev-sync-key.sh
# Paste JSON into Cursor → Secrets → GCP_DEV_SYNC_SA_JSON
```

### Local Mac

```bash
gcloud auth application-default login
gcloud config set project ttf-restaurant-dev
./scripts/sync-secrets.sh
./scripts/audit-env.sh
```

### Deploy (already automatic)

- **Web/API builds:** GitHub Actions reads SM via Workload Identity
- **Cloud Run runtime:** Terraform wires SM → env vars / file mounts

## Rotation

### Secret Manager values

1. `gcloud secrets versions add …` in SM
2. Dev: `./scripts/sync-secrets.sh`
3. Cloud Run: new revision (push `infra/**` or redeploy API workflow)
4. Web: re-run Web workflow if build-time keys changed

### dev-sync SA key (Cursor bootstrap)

Terraform [`project-security`](../infra/terraform/modules/project-security/) enforces **90-day max age** on service account JSON keys (`iam.serviceAccountKeyExpiryHours`).

```bash
./scripts/audit-dev-sync-keys.sh    # warns when <=15 days remain
./scripts/rotate-dev-sync-key.sh    # new key → update Cursor → revoke old keys
```

## Hardening (repo + deploy)

| Control | Where |
|---------|--------|
| `AUTH_DEV_MODE` blocked on Cloud Run | API `security_config.py` — fails startup if `K_SERVICE`, `TTF_DEPLOYED`, or Cloud SQL URL |
| `AUTH_DEV_MODE=false` in deploy | Terraform `phase-b.tf` `container_env` |
| Committed secret scan | `./scripts/secret-scan.sh` (gitleaks) — pre-push + GitHub CI |
| Dev-sync least privilege | `dev-sync.tf` — `secretAccessor` on `sync_dev=true` secrets only |
| Prod secrets not on VM | SM → CI / Cloud Run only (`sync_dev=false` for infra secrets) |

## Audit (no secret values printed)

```bash
./scripts/audit-env.sh
./scripts/list-sm-secrets.sh
```

## Cleanup after migration

See [SECRET_SYNC_MIGRATION.md](SECRET_SYNC_MIGRATION.md).

## Related

- [CLOUD_AGENT.md](CLOUD_AGENT.md) — Cursor one-secret setup
- [MCP_SETUP.md](MCP_SETUP.md) — GitHub MCP uses `.secrets/mcp.env`
- [CI.md](CI.md) — pipeline behavior
