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

When you add a rule in **Settings → Branches** (or **Rules → Rulesets**) for `main`, required checks must match **exact job names** from Actions. GitHub shows them as **`Workflow name / Job name`**.

### Required check on `main` (current)

After the path-filtered CI update, require **one** summary check:

| Status check in UI | Purpose |
|--------------------|---------|
| **CI / CI** | Always runs; passes when path-filtered web/api builds succeed or are skipped |

Do **not** require **CI / Web build** or **CI / API build** individually — they are skipped when those paths did not change. **CI / Terraform validate** no longer exists (Terraform is validated in **terraform.yml** only).

Optional for infra PRs:

| Status check in UI | When it runs |
|--------------------|--------------|
| **Terraform / Terraform Plan (dev)** | PR/push touching `infra/**` |

### Rulesets UI tip

Search the check picker for `CI` or `Terraform`. If **CI / CI** does not appear, merge one PR first so the workflow has run on `main`.

## When deploys do not run

| Symptom | Fix |
|---------|-----|
| API endpoint 422 / old behavior | API workflow may not have run — push a commit touching `api/**` or **Actions → API → Run workflow** |
| Web missing env (maps, Firebase) | Re-run **Web** after Terraform apply (or push `infra/**` to trigger apply + auto-redeploy) |
| Terraform drift | **Actions → Terraform** — fix plan errors; apply runs automatically on green plan for `main` |

## Manual redeploy

**Actions** tab → select **API** or **Web** → **Run workflow** → branch `main`.
