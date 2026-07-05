# GitHub Actions layout

GitHub requires all workflow YAML files in this directory (no subfolders). We use **filename prefixes** to show role:

| Prefix | Role |
|--------|------|
| `deploy.yml` | **Pipeline entry point** — push to `main` only |
| `reusable-*.yml` | Deploy modules — `workflow_call` from `deploy.yml`, plus `workflow_dispatch` for manual redeploys |
| `tool-*.yml` | Manual utilities — `workflow_dispatch` only |

## Path filters (single source of truth)

All path-aware CI and deploy gating is defined in [`scripts/ci_path_filters.py`](../../scripts/ci_path_filters.py). Both `deploy.yml` and [`scripts/ci-check.sh`](../../scripts/ci-check.sh) consume it — edit filters there only.

| Stack flag | Deploy job | Trigger groups |
|------------|------------|----------------|
| `infra` | Terraform | `infra/**`, `reusable-terraform.yml` |
| `api` | API | `api/**`, API contract paths, pipeline edits |
| `web` | Web + Admin Web | `web/**`, API contract, `design/**`, pipeline edits |
| `ios` | Path-check note only | `ios/**`, `design/**` (Xcode build stays manual in `tool-ios.yml`) |
| `tokens` | CI verify step | `design/**`, `web/**`, `ios/**` — runs `verify-design-tokens.sh` |

**Cross-stack API contract** (triggers **both** API and Web): `web/src/api/**`, `api/ttf_api/routers/**`, `api/openapi.yaml`, shared schema modules.

**Pipeline edits** (`deploy.yml`, `ci_path_filters.py`) re-run service CI/deploy wiring but **do not** run Terraform apply.

After a successful Terraform apply, all Cloud Run services redeploy (build args may have changed).

## `reusable-*`

| File | Dispatches as | Deploys |
|------|---------------|---------|
| `reusable-terraform.yml` | Terraform | GCP infra (`infra/terraform`) |
| `reusable-api.yml` | API | `ttf-api` Cloud Run |
| `reusable-web.yml` | Web | `ttf-web` Cloud Run |
| `reusable-admin-web.yml` | Admin Web | `ttf-admin-web` Cloud Run |

## `tool-*`

| File | Purpose |
|------|---------|
| `tool-debug-logs.yml` | Fetch recent Cloud Logging for a Cloud Run service |
| `tool-ios.yml` | Manual iOS simulator/archive build (Phase 3) |

Full runbook: [docs/CI.md](../../docs/CI.md).
