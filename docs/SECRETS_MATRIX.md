# Secrets & environment matrix

**Write secrets once in GCP Secret Manager.** Dev machines and CI pull from there — no copy-paste into `.env`, Cursor UI, or GitHub Secrets (except one-time bootstrap).

Never commit filled `.env`, `web/.env.local`, or `.secrets/`.

**Canonical source of truth:** [`infra/terraform/modules/secrets/catalog.tf`](../infra/terraform/modules/secrets/catalog.tf) — every SM entry has labels (`category`, `confidentiality`, `environment`, `sync_dev`) and annotations (`title`, `purpose`, `env-alias`, `seed-hint`).

**Important:** GSM stores both **confidential secrets** and **public build-time config** (browser bundle keys). Presence in SM is for distribution convenience — check the **Type** column before treating a leak as an incident.

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

### Confidential secrets (leak is an incident)

| SM secret ID | Env alias | Category | Type | Purpose | Dev sync? |
|--------------|-----------|----------|------|---------|-----------|
| `ttf-maps-api-key` | `MAPS_API_KEY` | api | secret | Server Places/Geocoding | yes |
| `ttf-firebase-admin-sa` | `.secrets/firebase-sa.json` | api | secret | API JWT verify | yes |
| `ttf-gemini-api-key` | `GEMINI_API_KEY` | api | secret | Review chat | yes |
| `ttf-github-pat-mcp` | `GITHUB_PERSONAL_ACCESS_TOKEN` | dev-tool | secret | Cursor GitHub MCP | yes |
| `ttf-dev-test-credentials` | `DEV_TEST_*` | dev-tool | secret | Optional browser tests | yes |
| `ttf-apple-sign-in-key` | `APPLE_*` / `APPLE_SIGN_IN_KEY_JSON` | api | secret | Apple revoke on delete | yes |
| `ttf-iap-oauth` | Terraform IAP vars | terraform | secret | Admin IAP OAuth | no |
| `ttf-db-url` | `DATABASE_URL` | infra | secret | Cloud SQL DSN | no |
| `ttf-internal-job-secret` | `INTERNAL_JOB_SECRET` | infra | secret | Scheduler job token | no |

### Public build-time config (GSM-distributed; ends up in browser bundle)

Protected by API-key referrer restrictions and App Check — not by secrecy.

| SM secret ID | Env alias | Category | Type | Purpose | Dev sync? |
|--------------|-----------|----------|------|---------|-----------|
| `ttf-maps-web-api-key` | `VITE_GOOGLE_MAPS_API_KEY` | web | public-build | Browser Maps JS API | yes |
| `ttf-firebase-web-env` | `web/.env.local` VITE_* | web | public-build | Firebase web SDK JSON | yes |
| `ttf-recaptcha-site-key` | `VITE_APP_CHECK_RECAPTCHA_SITE_KEY` | web | public-build | App Check (optional local) | yes |

### Deploy metadata (public URLs for CI wiring)

| SM secret ID | Env alias | Category | Type | Purpose | Dev sync? |
|--------------|-----------|----------|------|---------|-----------|
| `ttf-api-public-url` | api origin | infra | deploy-config | CI deploy URL | no |
| `ttf-web-public-url` | app origin | infra | deploy-config | CI deploy URL | no |
| `ttf-admin-public-url` | admin origin | infra | deploy-config | CI deploy URL | no |

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

**Personal / solo GCP projects:** there is no org or folder to attach IAM to, and the CI Terraform service account cannot create project org policies. Rotation is **script + calendar discipline** (target 90 days), not enforced by GCP.

Optional: as **project Owner**, you can enable `enable_sa_key_max_age_policy = true` in gitignored `terraform.tfvars` and apply locally — but CI keeps it off in `ci.tfvars`, so the next infra deploy would remove it. For solo dev, skip the org policy module.

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

- [SECRETS_AUDIT_REMEDIATION_CHECKLIST.md](SECRETS_AUDIT_REMEDIATION_CHECKLIST.md) — post-audit verification
- [CLOUD_AGENT.md](CLOUD_AGENT.md) — Cursor one-secret setup
- [MCP_SETUP.md](MCP_SETUP.md) — GitHub MCP uses `.secrets/mcp.env`
- [CI.md](CI.md) — pipeline behavior
