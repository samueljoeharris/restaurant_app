# Cursor Cloud Agent setup

Real Firebase dev (`ttf-restaurant-dev`) — same as `app.dev`.

## Secrets: one Runtime Secret

Per [Cursor security docs](https://cursor.com/docs/cloud-agent/security-network):

| Cursor type | Use for |
|-------------|---------|
| **Environment variables** | Non-sensitive config — copy [`.env.cloud.visible.example`](../.env.cloud.visible.example) |
| **Runtime Secret (one)** | `GCP_DEV_SYNC_SA_JSON` — dev-sync service account key JSON |

**Do not** paste `MAPS_API_KEY`, `VITE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or `GITHUB_PERSONAL_ACCESS_TOKEN` into Cursor anymore. Bootstrap runs `./scripts/sync-secrets.sh` which pulls everything from Secret Manager.

### Create the bootstrap key

After Terraform applies [`dev-sync.tf`](../infra/terraform/environments/dev/dev-sync.tf):

```bash
./scripts/create-dev-sync-key.sh
```

Paste the entire JSON file into **Cursor → Cloud Agents → Secrets → `GCP_DEV_SYNC_SA_JSON`**.

### Restart agent

Startup: `bootstrap-cloud-env.sh` → `sync-secrets.sh` → Docker.

```bash
bash .cursor/scripts/cloud-agent-bootstrap.sh   # new VM verify (sync + audit + API smoke)
bash .cursor/scripts/cloud-eval-up.sh
cd web && npm run dev
./scripts/audit-env.sh
```

## Emulator mode (optional)

Add visible env `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099` and `VITE_USE_AUTH_EMULATOR=true` — skips Secret Manager.

## Deployed `app.dev`

Local Cursor config does not fix broken deploys. After rotating SM secrets, re-run the **Web** GitHub workflow.

See [SECRETS_MATRIX.md](SECRETS_MATRIX.md) and [SECRET_SYNC_MIGRATION.md](SECRET_SYNC_MIGRATION.md).
