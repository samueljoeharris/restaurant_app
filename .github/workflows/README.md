# GitHub Actions layout

GitHub requires all workflow YAML files in this directory (no subfolders). We use **filename prefixes** to show role:

| Prefix | Role |
|--------|------|
| `deploy.yml` | **Pipeline entry point** — push to `main` only |
| `reusable-*.yml` | Deploy modules — `workflow_call` from `deploy.yml`, plus `workflow_dispatch` for manual redeploys |
| `tool-*.yml` | Manual utilities — `workflow_dispatch` only |

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
