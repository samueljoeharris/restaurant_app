# CI/CD (local + dev GCP)

## Architecture

| Layer | What runs | When |
|-------|-----------|------|
| **Local** | `./scripts/ci-check.sh` (Docker) | Before push; git hook + Cursor hook |
| **CI** (`ci.yml`) | Path-filtered Docker builds for web/api | PR + push to `main` |
| **Terraform** (`terraform.yml`) | Plan (PR) / apply (`main`) against dev GCP | `infra/**` changes |
| **Deploy** (`api.yml`, `web.yml`) | Build, push, deploy to dev Cloud Run | Path changes or post-terraform redeploy |

Infra validation (Terraform fmt + validate locally; plan + apply in GitHub) lives in **terraform.yml**, not the generic CI workflow.

After a successful **Terraform apply** on `main`, API and Web deploy workflows are dispatched automatically so dev services pick up new secrets and infra.

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

Requires Docker Desktop running.

## GitHub workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Every push/PR to `main` | **Required gate** — path-filtered Docker builds; job **CI** must pass |
| **Terraform** | `infra/**` | Plan on PR; plan + auto-apply on `main`; redeploys api + web after apply |
| **API** | `api/**` or workflow_dispatch | Build + deploy `ttf-api` to dev Cloud Run |
| **Web** | `web/**` or workflow_dispatch | Build + deploy `ttf-web` to dev Cloud Run |

Deploy workflows are **path-filtered**. A green **CI** workflow does not mean Cloud Run was updated — check deploy workflows when you changed runtime code.

## Branch protection (recommended)

`main` is not protected yet. When you add a rule in **Settings → Branches** (or **Rules → Rulesets**), required checks must match **exact job names** from Actions. GitHub shows them as **`Workflow name / Job name`**.

### What GitHub shows today (`main` — current `ci.yml`)

Require these three checks (they run on every PR/push):

| Status check in UI | Workflow job |
|--------------------|--------------|
| **CI / Web build** | `web-build` |
| **CI / API build** | `api-build` |
| **CI / Terraform validate** | `terraform-validate` |

Terraform **plan/apply** is a separate workflow — optional extra check for infra PRs:

| Status check in UI | When it runs |
|--------------------|--------------|
| **Terraform / Terraform Plan (dev)** | PR/push touching `infra/**` |

There is **no** `CI / CI` check on `main` yet — that name only exists in the updated local `ci.yml` (not merged).

### After merging the path-filtered `ci.yml` update

Replace the three CI checks above with one summary check:

| Status check in UI | Purpose |
|--------------------|---------|
| **CI / CI** | Always runs; passes when path-filtered web/api builds succeed or are skipped |

Remove **CI / Terraform validate** from required checks — Terraform fmt/validate moves to **terraform.yml** only.

Optional path-specific jobs (only appear when those paths change): **CI / Web build**, **CI / API build** — do not require these individually if **CI / CI** is required.

### Rulesets UI tip

In **Rules → Rulesets**, search the check picker for `CI` or `Terraform`. Names must match Actions exactly (including capitalization). If a check never ran on a PR, it may not appear until that workflow has run once on the branch.

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API workflow may not have run — push a commit touching `api/**` or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform apply (or push `infra/**` to trigger apply + auto-redeploy) |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs automatically on green plan for `main` |

## Manual redeploy

**Actions** tab → select **API** or **Web** → **Run workflow** → branch `main`.
