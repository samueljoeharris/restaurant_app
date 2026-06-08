# TTF — Terraform (GCP)

Infrastructure as code for the TTF restaurant app. **No GCP Organization** — resources live in project `ttf-restaurant-dev` (free account / no folders).

## Phased deploy

### Phase A (default) — apply now

Foundation only. **No monthly compute cost.** Use local Postgres (`docker compose up postgres`) for API development.

| Resource | Name |
|----------|------|
| Enabled APIs | Secret Manager, Artifact Registry, Storage, IAM, Geocoding, Places |
| Artifact Registry | `ttf-containers` |
| Cloud Storage | `ttf-uploads-dev` |
| Secret Manager | `ttf-maps-api-key` (container) |
| Service accounts | `ttf-api-runtime`, `ttf-github-deploy` |
| Optional | Billing budget alert |

`terraform.tfvars`: `enable_cloud_sql = false`, `enable_cloud_run = false`

### Phase B — when API deploys to GCP

Enable in `terraform.tfvars` after `api/` image is pushed to Artifact Registry.

| Resource | Name | Cost |
|----------|------|------|
| Cloud SQL Postgres 15 | `ttf-db` | ~$7–10/mo |
| Secret | `ttf-db-url` (populated) | — |
| Cloud Run | `ttf-api` | Scales to zero |

```hcl
enable_cloud_sql = true
enable_cloud_run = true
api_image = "us-central1-docker.pkg.dev/ttf-restaurant-dev/ttf-containers/ttf-api:latest"
```

Defined in [`environments/dev/phase-b.tf`](environments/dev/phase-b.tf).

**Not in Terraform (console):** Firebase linking, Apple Sign-In, Maps API key **creation** (value stored via `gcloud secrets versions add`).

## Prerequisites

1. GCP project created: `ttf-restaurant-dev` ([console](https://console.cloud.google.com))
2. Billing linked to project (free trial OK)
3. `gcloud auth application-default login`
4. Docker Desktop running

```bash
gcloud config set project ttf-restaurant-dev
gcloud auth application-default login
```

## Layout

```
infra/terraform/
├── bootstrap/              # One-time: GCS state bucket (local state)
├── environments/
│   └── dev/                # Dev stack (remote state after bootstrap)
└── modules/
    ├── project-services/
    ├── artifact-registry/
    ├── cloud-sql/
    ├── storage/
    ├── secrets/
    ├── iam/
    └── cloud-run/
```

## Quick start

### 1. Bootstrap remote state (once)

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars
# Edit: project_id, terraform_admin_email

# From repo root — uses Docker + your gcloud credentials
docker compose run --rm terraform -chdir=bootstrap init
docker compose run --rm terraform -chdir=bootstrap plan
docker compose run --rm terraform -chdir=bootstrap apply
```

Copy the `backend_config_snippet` from output, or:

```bash
cp ../environments/dev/backend.tf.example ../environments/dev/backend.tf
# Edit bucket name if you changed state_bucket_name
```

### 2. Deploy dev environment

```bash
cd infra/terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edit project_id, uploads_bucket_name (must be globally unique)

docker compose run --rm terraform -chdir=environments/dev init
docker compose run --rm terraform -chdir=environments/dev plan
docker compose run --rm terraform -chdir=environments/dev apply
```

### 3. Note outputs

```bash
docker compose run --rm terraform -chdir=environments/dev output
```

Key outputs: `cloud_run_url`, `artifact_registry_url`, `api_image_target`.

## CI (GitHub Actions)

Workflow: [`.github/workflows/terraform.yml`](../../.github/workflows/terraform.yml)

| Event | Job |
|-------|-----|
| PR touching `infra/**` | `terraform plan` with committed [`ci.tfvars`](environments/dev/ci.tfvars) |
| Push to `main` | `terraform apply` (GitHub environment: `dev`) |

### One-time setup (Workload Identity Federation — no SA keys)

Uses [GCP WIF for deployment pipelines](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines). GitHub Actions exchanges an OIDC token for short-lived credentials; no `GCP_SA_KEY` JSON in secrets.

1. Apply dev stack locally (creates `ttf-github-terraform` SA + WIF pool):

   ```bash
   docker compose run --rm terraform -chdir=environments/dev apply
   ```

2. Set GitHub **repository variables** from Terraform outputs:

   ```bash
   bash infra/terraform/scripts/setup-github-wif-vars.sh
   ```

   Or manually under **Settings → Secrets and variables → Variables**:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` — from `terraform output github_workload_identity_provider`
   - `GCP_TERRAFORM_SERVICE_ACCOUNT` — from `terraform output github_terraform_service_account`

3. (Optional) GitHub → **Settings → Environments → New environment** → name `dev` → required reviewers for apply on `main`.

WIF trusts only `samueljoeharris/restaurant_app` (see `github_repository` in `ci.tfvars`).

Repository variables (Actions → Variables):

| Variable | Service account |
|----------|-----------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | from `terraform output github_workload_identity_provider` |
| `GCP_TERRAFORM_SERVICE_ACCOUNT` | `ttf-github-terraform@...` |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `ttf-github-deploy@...` |

### API deploy (`.github/workflows/api.yml`)

On push to `main` (`api/**`): build image → Artifact Registry → `gcloud run services update` (when Phase B service exists). Terraform creates Cloud SQL + Cloud Run; **api.yml owns image updates** (`lifecycle.ignore_changes` on image).

## Day-to-day commands (from repo root)

```bash
# Plan
docker compose run --rm terraform -chdir=environments/dev plan

# Apply
docker compose run --rm terraform -chdir=environments/dev apply

# Destroy (careful)
docker compose run --rm terraform -chdir=environments/dev destroy
```

## Phase B — after API is built

1. Build and push image to `api_image_target` output URL
2. Set in `terraform.tfvars`:

   ```hcl
   enable_cloud_sql = true
   enable_cloud_run = true
   api_image = "us-central1-docker.pkg.dev/ttf-restaurant-dev/ttf-containers/ttf-api:latest"
   ```

3. `terraform apply` again

## Maps API key

Terraform enables **Geocoding API** and **Places API**, and creates secret container `ttf-maps-api-key`.

Create the key in **APIs & Services → Credentials** (name: `ttf-maps-dev`), restrict to those APIs, then store the value:

```bash
echo -n "YOUR_MAPS_KEY" | gcloud secrets versions add ttf-maps-api-key --data-file=-
```

## Cost notes

- **Phase A:** pennies (storage + registry metadata; no compute)
- **Phase B:** Cloud SQL is the main cost (~$7–10/mo); Cloud Run scales to zero when idle
- `terraform destroy` when not actively developing

## Prod

Copy `environments/dev` → `environments/prod` when pilot launches, or add `prod/` with `ttf-restaurant-prod` project.
