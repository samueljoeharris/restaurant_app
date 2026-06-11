# CI/CD (local + dev GCP)

## Architecture

| Layer | What runs | When |
|-------|-----------|------|
| **Local** | `./scripts/ci-check.sh` (Docker) | Before push; git hook + Cursor hook |
| **CI** (`ci.yml`) | Path-filtered Docker builds for web/api | **Push to `main` only** |
| **Terraform** (`terraform.yml`) | Plan + apply on `main` | `infra/**` changes (or manual dispatch) |
| **Deploy** (`api.yml`, `web.yml`, `admin-web.yml`) | Build, push, deploy to dev Cloud Run | Path changes or post-terraform redeploy |

Infra validation (Terraform fmt + validate locally; plan + apply in GitHub) lives in **terraform.yml**, not the generic CI workflow.

After a successful **Terraform apply** on `main`, API, Web, and Admin deploy workflows are dispatched automatically.

## Solo dev workflow (Option A)

This repo is configured for **one developer pushing directly to `main`** — no PR-based CI.

```
1. ./scripts/ci-check.sh          # optional local gate
2. git push origin main
3. CI runs once (if web/api changed)
4. Terraform runs once (if infra/** changed) — plan then apply
5. Deploy workflows run on path changes (or after terraform redeploy)
```

**Terraform manual apply:** Actions → **Terraform** → Run workflow → check **apply = true** (also runs automatically on `main` push when `infra/**` changes).

**No branch protection required.** Remove required status checks in GitHub if you had them — workflows no longer run on pull requests.

## Local checks (before push)

All checks use **Docker** — same images as Cloud Run (`web/Dockerfile`, `api/Dockerfile`, `hashicorp/terraform` via compose).

```bash
# One-time: install git pre-push hook
./scripts/setup-githooks.sh

# Path-aware (changed files vs origin/main)
./scripts/ci-check.sh

# Full suite (web + api + terraform validate)
./scripts/ci-check.sh --all

# Skip once (emergency only)
SKIP_CI=1 git push
```

**Cursor hook:** `.cursor/hooks.json` runs the same checks before agent-initiated `git push` (blocks `--no-verify`).

Requires Docker Desktop on local machines. Cursor Cloud Agents install Docker via `.cursor/environment.json` and start the daemon automatically at boot.

## GitHub workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push to `main` | Path-filtered Docker builds for web/api |
| **Terraform** | Push to `main` (`infra/**`) or workflow_dispatch | Plan + apply dev GCP |
| **API** | Push to `main` (`api/**`) or workflow_dispatch | Deploy `ttf-api` |
| **Web** | Push to `main` (`web/**`) or workflow_dispatch | Deploy `ttf-web` |
| **Admin Web** | Push to `main` (`web/**`) or workflow_dispatch | Deploy `ttf-admin-web` |

Deploy workflows are **path-filtered**. A green **CI** workflow does not mean Cloud Run was updated — check deploy workflows when you changed runtime code.

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API workflow may not have run — push a commit touching `api/**` or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform apply (or push `infra/**` to trigger apply + auto-redeploy) |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs on `main` push or manual dispatch |
| Admin IAP errors after infra change | Push `infra/**` or run **Terraform** with apply; needs `IAP_OAUTH_*` in Environment `dev` |

## Manual redeploy

**Actions** tab → select **API**, **Web**, or **Admin Web** → **Run workflow** → branch `main`.
