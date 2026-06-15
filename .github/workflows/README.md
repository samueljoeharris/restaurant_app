# GitHub Actions layout

| Path | Role |
|------|------|
| [`deploy.yml`](deploy.yml) | **Pipeline entry point** — push to `main` only. Runs CI checks, then calls reusable workflows in order. |
| [`reusable/`](reusable/) | **Reusable deploy modules** — `workflow_call` from `deploy.yml`, plus `workflow_dispatch` for manual redeploys. |
| [`tools/`](tools/) | **Manual utilities** — `workflow_dispatch` only; not part of the push pipeline. |

## `reusable/`

| Workflow | Dispatches as | Deploys |
|----------|---------------|---------|
| `terraform.yml` | Terraform | GCP infra (`infra/terraform`) |
| `api.yml` | API | `ttf-api` Cloud Run |
| `web.yml` | Web | `ttf-web` Cloud Run |
| `admin-web.yml` | Admin Web | `ttf-admin-web` Cloud Run |

## `tools/`

| Workflow | Purpose |
|----------|---------|
| `debug-logs.yml` | Fetch recent Cloud Logging for a Cloud Run service |
| `ios.yml` | Manual iOS simulator/archive build (Phase 3) |

Full runbook: [docs/CI.md](../../docs/CI.md).
