# Secrets audit remediation checklist

Post-implementation runbook for the 2026-06-20 audit ([SECRETS_AUDIT.md](SECRETS_AUDIT.md)).

## Agent completed during implementation

- [x] `scripts/load-dev-env.sh`, `scripts/run-api.sh`, `scripts/run-api-script.sh`
- [x] Native API default in `start-local.sh` and `cloud-eval-up.sh` (`--docker-api` escape hatch)
- [x] Canonical Firebase SA path: `.secrets/firebase-sa.json` (no repo-root copy from sync)
- [x] `catalog.tf` `confidentiality` labels + split [SECRETS_MATRIX.md](SECRETS_MATRIX.md)
- [x] Extended `scripts/audit-env.sh`

## Verify after merge to `main`

These steps confirm GHA Terraform applied the new SM labels.

- [ ] **GHA Terraform Apply (dev)** green on `main` push ([CI/CD workflow](../.github/workflows/deploy.yml))
- [ ] `./scripts/list-sm-secrets.sh` shows **TYPE** (`confidentiality`) column for all secrets
- [ ] `./scripts/audit-env.sh` — no WARN lines for legacy `firebase-sa.json` or wrong SA path

## Local Mac smoke (any time)

Requires **Python 3.14** on PATH (matches `api/Dockerfile` and GHA). Mac: `brew install python@3.14`. Cloud VM: preinstalled via `.cursor/Dockerfile` (deadsnakes).

```bash
./scripts/sync-secrets.sh
./scripts/audit-env.sh
docker compose stop api 2>/dev/null || true
./scripts/start-local.sh
# In another terminal:
curl -sf http://localhost:8080/health
```

- [ ] Postgres container running (`docker compose ps postgres`)
- [ ] No `api` container unless you used `--docker-api`
- [ ] Health check returns OK

Optional legacy path:

```bash
./scripts/start-local.sh --docker-api
curl -sf http://localhost:8080/health
```

- [ ] Docker API path still works

## Cursor Cloud VM smoke

After VM boot (`bootstrap-cloud-env.sh` + `start-docker.sh`):

```bash
bash .cursor/scripts/cloud-eval-up.sh
```

- [ ] No API Docker image build in output
- [ ] Native API on `:8080/health`
- [ ] Postgres (and emulator if configured) in Docker only

## No UI changes required

| Surface | Action |
|---------|--------|
| Cursor Runtime Secret `GCP_DEV_SYNC_SA_JSON` | **No change** |
| GitHub Secrets / WIF | **No change** |
| GCP Secret Manager secret **values** | **No change** — labels only via Terraform |

## Cleanup (one-time per machine)

```bash
rm -f firebase-sa.json   # legacy repo-root copy
./scripts/sync-secrets.sh
```

- [ ] Only `.secrets/firebase-sa.json` exists (plus Cloud Run mount path in prod — not local)

## Related

- [SECRETS_AUDIT.md](SECRETS_AUDIT.md) — original audit
- [SECRETS_MATRIX.md](SECRETS_MATRIX.md) — inventory with confidentiality types
- [CLOUD_AGENT.md](CLOUD_AGENT.md) — Cursor one-secret setup
