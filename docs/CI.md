# CI/CD (local + dev GCP)

## Architecture

| Layer | What runs | When |
|-------|-----------|------|
| **Local** | `./scripts/ci-check.sh` (Docker) | Before push; git hook + Cursor hook |
| **CI** (`ci.yml`) | Path-filtered Docker builds for web/api | **Push to `main` only** |
| **Deploy** (`deploy.yml`) | Orchestrated pipeline: Terraform → API/Web/Admin deploys | **Push to `main` only** (path-aware jobs) |

**`deploy.yml` is the single deploy entrypoint on push.** It detects which paths changed, runs Terraform plan + apply first when `infra/**` changed, then deploys services — so infra changes always land before the code that depends on them. `terraform.yml`, `api.yml`, `web.yml`, and `admin-web.yml` are reusable workflows called by the pipeline; they no longer trigger on push themselves, but each keeps `workflow_dispatch` for manual runs.

Service deploys run when their paths changed **or** after a successful Terraform apply (apply can change env vars / secrets baked into images). A failed Terraform apply blocks all service deploys for that push.

Infra validation (Terraform fmt + validate locally; plan + apply in GitHub) lives in **terraform.yml**, not the generic CI workflow.

## Solo dev workflow (Option A)

This repo is configured for **one developer pushing directly to `main`** — no PR-based CI.

```
1. ./scripts/ci-check.sh          # optional local gate
2. git push origin main
3. CI runs once (if web/api changed)
4. Deploy pipeline runs once:
   a. Terraform plan + apply (if infra/** changed)
   b. API / Web / Admin Web deploys (if their paths changed, or after apply)
```

**Terraform manual apply:** Actions → **Terraform** → Run workflow → check **apply = true** (also runs automatically inside the **Deploy** pipeline on `main` push when `infra/**` changes — note a manual Terraform apply does **not** redeploy services; dispatch them yourself if env vars changed).

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

# Terraform plan against dev GCP (read-only; needs gcloud ADC)
./scripts/terraform-plan-local.sh

# Skip once (emergency only)
SKIP_CI=1 git push
```

**Cursor hook:** `.cursor/hooks.json` runs the same checks before agent-initiated `git push` (blocks `--no-verify`).

Requires Docker Desktop on local machines. Cursor Cloud Agents install Docker via `.cursor/environment.json` and start the daemon automatically at boot. Terraform **plan** also needs `gcloud auth application-default login` (ADC is mounted into the compose `terraform` service).

`ci-check.sh` runs Terraform `fmt` + `validate` only. Use `terraform-plan-local.sh` before infra pushes — same `ci.tfvars` as GitHub Actions — to catch plan errors early.

### Local stack (API + Postgres)

```bash
./scripts/start-local.sh          # postgres + api on :8080, seeds Dedham if empty
curl http://localhost:8080/health
cd web && npm run dev             # http://localhost:5173
```

## GitHub workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push to `main` | Path-filtered Docker builds for web/api (required check) |
| **Deploy** | Push to `main` | Orchestrates Terraform → API / Web / Admin Web in order |
| **Terraform** | Called by Deploy, or workflow_dispatch | Plan + apply dev GCP |
| **API** | Called by Deploy, or workflow_dispatch | Deploy `ttf-api` |
| **Web** | Called by Deploy, or workflow_dispatch | Deploy `ttf-web` |
| **Admin Web** | Called by Deploy, or workflow_dispatch | Deploy `ttf-admin-web` |

Deploy jobs are **path-aware** inside the pipeline. A green **CI** workflow does not mean Cloud Run was updated — check the **Deploy** run when you changed runtime code.

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API job may have been skipped — check the **Deploy** run, or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform apply (or push `infra/**` — the pipeline redeploys all services after apply) |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs in the Deploy pipeline on `main` push or via manual dispatch |
| Admin IAP errors after infra change | Push `infra/**` (pipeline applies + redeploys) or run **Terraform** with apply; needs `IAP_OAUTH_*` in Environment `dev` |

## Manual redeploy

**Actions** tab → select **API**, **Web**, or **Admin Web** → **Run workflow** → branch `main`.
