# CI/CD (local + dev GCP)

## Architecture

| Layer | What runs | When |
|-------|-----------|------|
| **Local** | `./scripts/ci-check.sh` (Docker) | Before push; git hook + Cursor hook |
| **Pipeline** (`deploy.yml`, workflow **CI/CD**) | checks → Terraform → build+deploy, path-aware | **Push to `main` only** |

**`deploy.yml` is the single pipeline on push** — there is no separate CI workflow. Stages:

1. **CI checks** (fast, no Docker): web `tsc` typecheck + eslint, API `compileall` + **app import smoke** (catches Cloud Run boot crashes), `terraform fmt -check`. Required check name: **CI/CD / CI**.
2. **Terraform** plan + apply, only when `infra/**` changed.
3. **API / Web / Admin Web**: build the real image once (prod build args from Secret Manager), push to Artifact Registry, update Cloud Run.

Nothing is built twice: checks don't build images, and each deploy job builds exactly one image. `reusable/terraform.yml`, `reusable/api.yml`, `reusable/web.yml`, and `reusable/admin-web.yml` are called by the pipeline; each keeps `workflow_dispatch` for manual runs. See [`.github/workflows/README.md`](../.github/workflows/README.md).

Service deploys run when their paths changed **or** after a successful Terraform apply (apply can change env vars / secrets baked into images). Failed checks block everything; a failed Terraform apply blocks all service deploys for that push.

## Solo dev workflow (Option A)

This repo is configured for **one developer pushing directly to `main`** — no PR-based CI.

```
1. ./scripts/ci-check.sh          # optional local gate
2. git push origin main
3. CI/CD pipeline runs once:
   a. CI checks (typecheck, lint, app import smoke, terraform fmt)
   b. Terraform plan + apply (if infra/** changed)
   c. API / Web / Admin Web deploys (if their paths changed, or after apply)
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
./scripts/start-local.sh          # postgres + api on :8080, seeds restaurants if empty
curl http://localhost:8080/health
cd web && npm run dev             # http://localhost:5173
```

## GitHub workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI/CD** (`deploy.yml`) | Push to `main` | CI checks, then Terraform → API / Web / Admin Web in order |
| **Terraform** (`reusable/terraform.yml`) | Called by CI/CD, or workflow_dispatch | Plan + apply dev GCP |
| **API** (`reusable/api.yml`) | Called by CI/CD, or workflow_dispatch | Deploy `ttf-api` |
| **Web** (`reusable/web.yml`) | Called by CI/CD, or workflow_dispatch | Deploy `ttf-web` |
| **Admin Web** (`reusable/admin-web.yml`) | Called by CI/CD, or workflow_dispatch | Deploy `ttf-admin-web` |
| **Debug Logs** (`tools/debug-logs.yml`) | workflow_dispatch | Fetch Cloud Run logs |
| **iOS** (`tools/ios.yml`) | workflow_dispatch | Manual iOS build |

Jobs are **path-aware** inside the pipeline — skipped jobs mean those paths didn't change in the push (and Terraform didn't apply).

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API job may have been skipped — check the **Deploy** run, or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform apply (or push `infra/**` — the pipeline redeploys all services after apply) |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs in the Deploy pipeline on `main` push or via manual dispatch |
| Admin IAP errors after infra change | Push `infra/**` (pipeline applies + redeploys) or run **Terraform** with apply; needs `IAP_OAUTH_*` in Environment `dev` |

## Manual redeploy

**Actions** tab → select **API**, **Web**, or **Admin Web** → **Run workflow** → branch `main`.
