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

Rotate before **90 days** (calendar + audit scripts — see [SECRETS_MATRIX.md](SECRETS_MATRIX.md#dev-sync-sa-key-cursor-bootstrap)):

```bash
./scripts/audit-dev-sync-keys.sh
./scripts/rotate-dev-sync-key.sh
```

### VM security notes

- Synced secrets live as **plaintext files** in `.secrets/` on the VM disk (gitignored, `chmod 600`) — same risk model as a dev laptop.
- Runtime Secret redacts values from **agent chat/commits**, but secrets are still visible in the **terminal**.
- Use Cursor **network allowlists** to limit exfiltration (cloud agents auto-run commands).
- Prod credentials (`ttf-db-url`, etc.) never sync to the VM — deploy path only.

### Restart agent

Startup: `bootstrap-cloud-env.sh` → `sync-secrets.sh` → Docker.

```bash
bash .cursor/scripts/cloud-agent-bootstrap.sh   # new VM verify (sync + audit + API smoke)
bash .cursor/scripts/cloud-eval-up.sh
cd web && npm run dev
./scripts/audit-env.sh
```

### Browser test login (optional)

Shared email/password for UI validation live in **`ttf-dev-test-credentials`** (JSON: `email`, `password`). Sync writes `.secrets/dev-test.env` as `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`.

- **Canonical email:** `contrib-1781961579@ttf.test`
- **One-time seed:** `./scripts/seed-dev-test-credentials.sh` (requires SM admin — dev-sync SA is read-only)
- **Agents:** after bootstrap, `source scripts/load-dev-test-env.sh` before browser sign-in; never print the password

See [AGENTS.md](../AGENTS.md) § Browser / UI test plan and [TEST_FLOWS.md](TEST_FLOWS.md).

## Emulator mode (optional)

Add visible env `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099` and `VITE_USE_AUTH_EMULATOR=true` — skips Secret Manager.

## Deployed `app.dev`

Local Cursor config does not fix broken deploys. After rotating SM secrets, re-run the **Web** GitHub workflow.

See [SECRETS_MATRIX.md](SECRETS_MATRIX.md) and [SECRET_SYNC_MIGRATION.md](SECRET_SYNC_MIGRATION.md).
