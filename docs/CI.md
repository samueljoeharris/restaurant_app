# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** (`ci.yml`) | Every push/PR to `main` | **Required gate** — web build, API docker build, Terraform validate |
| **API** (`api.yml`) | `api/**` push | Build + deploy `ttf-api` to Cloud Run |
| **Web** (`web.yml`) | `web/**` push | Build + deploy `ttf-web` to Cloud Run |
| **Terraform** (`terraform.yml`) | `infra/**` push | Plan + auto-apply on `main` |

Deploy workflows use **path filters**. A green **CI** workflow does not mean Cloud Run was updated — check deploy workflows too when you changed runtime code.

## Local checks (before push)

```bash
# One-time: install pre-push hook
./scripts/setup-githooks.sh

# Manual run (changed paths vs origin/main)
./scripts/ci-check.sh

# Full suite
./scripts/ci-check.sh --all

# Skip hook once (emergency only)
git push --no-verify

# Skip checks without disabling the hook permanently
SKIP_CI=1 git push
```

## Branch protection (recommended)

In GitHub → **Settings → Branches → Add rule** for `main`:

1. Require status check **CI / Web build** (and/or all three CI jobs)
2. Require status check **CI / API build**
3. Require status check **CI / Terraform validate**
4. Optionally require deploy workflows before considering a release done (manual process today)

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API workflow may not have run — push a commit touching `api/**` or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform writes secrets |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs automatically on green plan for `main` |

## Manual redeploy

**Actions** tab → select workflow → **Run workflow** → branch `main`.
