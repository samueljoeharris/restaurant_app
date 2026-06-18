# Secrets & environment matrix

**Write secrets once in GCP Secret Manager.** Dev machines and CI pull from there — no copy-paste into `.env`, Cursor UI, or GitHub Secrets (except one-time bootstrap).

Never commit filled `.env`, `web/.env.local`, `.secrets/`, or `firebase-sa.json`.

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

| SM secret ID | Env / file | Consumers |
|--------------|------------|-----------|
| `ttf-maps-api-key` | `MAPS_API_KEY` | API local + Cloud Run |
| `ttf-maps-web-api-key` | `VITE_GOOGLE_MAPS_API_KEY` | Web build + local Vite |
| `ttf-firebase-web-env` | JSON → `web/.env.local` | Web build + local Vite |
| `ttf-firebase-admin-sa` | `firebase-sa.json` | API JWT verify |
| `ttf-gemini-api-key` | `GEMINI_API_KEY` | API review chat |
| `ttf-github-pat-mcp` | `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub MCP (`.secrets/mcp.env`) |
| `ttf-dev-test-credentials` | JSON → `DEV_TEST_*` | Optional browser tests |
| `ttf-apple-sign-in-key` | JSON → `APPLE_*` / `APPLE_SIGN_IN_KEY_JSON` | Account delete Apple revoke |
| `ttf-recaptcha-site-key` | `VITE_APP_CHECK_RECAPTCHA_SITE_KEY` | Optional local App Check |
| `ttf-iap-oauth` | Terraform only | Admin IAP (not dev sync) |
| `ttf-db-url` | Cloud Run only | Production DB |

Non-secrets: [`.env.defaults`](../.env.defaults) (committed).

## Write a secret (once)

```bash
PROJECT=ttf-restaurant-dev
echo -n "VALUE" | gcloud secrets versions add SECRET_ID --project=$PROJECT --data-file=-
```

Create new secret containers via Terraform (`infra/terraform/environments/dev/main.tf` `secret_ids`) or:

```bash
gcloud secrets create SECRET_ID --project=$PROJECT --replication-policy=automatic
```

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

1. `gcloud secrets versions add …` in SM
2. Dev: `./scripts/sync-secrets.sh`
3. Cloud Run: new revision (push `infra/**` or redeploy API workflow)
4. Web: re-run Web workflow if build-time keys changed

## Audit (no secret values printed)

```bash
./scripts/audit-env.sh
```

## Cleanup after migration

See [SECRET_SYNC_MIGRATION.md](SECRET_SYNC_MIGRATION.md).

## Related

- [CLOUD_AGENT.md](CLOUD_AGENT.md) — Cursor one-secret setup
- [MCP_SETUP.md](MCP_SETUP.md) — GitHub MCP uses `.secrets/mcp.env`
- [CI.md](CI.md) — pipeline behavior
