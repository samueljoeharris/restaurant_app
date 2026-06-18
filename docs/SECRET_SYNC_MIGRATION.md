# Secret sync migration & cleanup

Run after the SM distributor PR merges.

## Validate

```bash
git pull
gcloud auth application-default login   # local Mac only
./scripts/sync-secrets.sh
./scripts/audit-env.sh
bash .cursor/scripts/cloud-eval-up.sh   # or ./scripts/start-local.sh
cd web && npm run dev
curl http://localhost:8080/health
```

Restart Cursor Cloud agent — bootstrap should sync without pasting individual keys.

## Seed new SM secrets (if not done)

```bash
PROJECT=ttf-restaurant-dev

# GitHub PAT for MCP
echo -n "ghp_..." | gcloud secrets versions add ttf-github-pat-mcp --project=$PROJECT --data-file=-

# Optional test login
echo '{"email":"you@example.com","password":"..."}' \
  | gcloud secrets versions add ttf-dev-test-credentials --project=$PROJECT --data-file=-

# Apple Sign-In (when ready)
echo '{"team_id":"...","key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----","client_id":"com.samueljoeharris.ttf"}' \
  | gcloud secrets versions add ttf-apple-sign-in-key --project=$PROJECT --data-file=-
```

## Terraform (dev-sync SA)

```bash
# After infra apply on main:
./scripts/create-dev-sync-key.sh
# Paste into Cursor → Runtime Secret GCP_DEV_SYNC_SA_JSON
```

## Cleanup checklist

### Cursor UI

- [ ] Remove old Runtime Secrets: `MAPS_API_KEY`, `GEMINI_API_KEY`, `VITE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `DEV_TEST_*`
- [ ] Keep only `GCP_DEV_SYNC_SA_JSON` + visible env vars from `.env.cloud.visible.example`

### Local Mac

- [ ] Delete secret lines from `.env` or delete `.env` entirely
- [ ] Delete `.env.cursor-visible` / `.env.cursor-runtime-checklist` from old merge script
- [ ] Keep `.env.defaults` (committed) — no secrets

### GitHub

- [ ] After Terraform CI succeeds reading `ttf-iap-oauth` from SM: remove `IAP_OAUTH_CLIENT_ID`, `IAP_OAUTH_CLIENT_SECRET` from Environment **dev**
- [ ] Keep GitHub **vars**: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `GCP_TERRAFORM_SERVICE_ACCOUNT`

### GCP

- [ ] Delete old dev-sync SA keys after rotating
- [ ] Confirm every app secret has an SM version (nothing Mac-only)
