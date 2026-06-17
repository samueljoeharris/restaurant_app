# Production Cutover Runbook — ttf-restaurant-prod

This runbook is a manual-steps checklist for cutting over the TTF restaurant app from the dev pilot project (`ttf-restaurant-dev`) to production (`ttf-restaurant-prod`). It applies Terraform infrastructure-as-code scaffolding in `infra/terraform/environments/prod/` and manually configures GCP, Firebase, DNS, and GitHub secrets. **Nothing has been applied to GCP yet** — this document is purely a checklist for a human to follow when GCP credentials and a billing account are available. For design context, see [docs/DESIGN.md](DESIGN.md); for the equivalent dev runbook, see [docs/LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md).

---

## Prerequisites

- [ ] **Apple Developer account:** Enrolled, 2FA enabled, legal name verified. Used to configure App Store Connect and TestFlight.
- [ ] **GoDaddy DNS access:** Admin rights to `littlescout.app` domain. Need to add A records and verify domain ownership.
- [ ] **GCP billing account:** An active billing account ID (format: `XXXXXX-XXXXXX-XXXXXX`). Verify you can create new GCP projects under this account.
- [ ] **Google account with GCP owner access:** Must have permission to create projects, link billing, and manage IAM under the billing account.
- [ ] **GitHub repository admin access:** Ability to create / configure GitHub Environments (`prod`) with secrets and required reviewers.

---

## 1. Create GCP Project

- [ ] Open [Google Cloud Console](https://console.cloud.google.com).
- [ ] Click **Select a Project** → **New Project**.
- [ ] Set **Project Name** = `TTF Restaurant (Prod)`.
- [ ] Verify **Organization** = (none) or select your intended organization.
- [ ] Click **Create**. Note the **Project ID** (auto-generated, globally unique); if it differs from `ttf-restaurant-prod`, use the actual ID for all subsequent steps.
- [ ] Wait for the project to be created (usually < 1 minute).

---

## 2. Link Billing Account

- [ ] In the GCP Console, go to the new project.
- [ ] Navigate to **Billing** → **Link a Billing Account**.
- [ ] Select your billing account (ID: `XXXXXX-XXXXXX-XXXXXX`).
- [ ] Click **Set as Billing Account**.
- [ ] Verify in **Billing → Overview** that the project is linked and shows your account.

---

## 3. Bootstrap Terraform State

The Terraform state must live in a GCS bucket. This is a one-time manual step per environment.

- [ ] From the repo root, navigate to `infra/terraform/bootstrap/`.
- [ ] Copy `terraform.tfvars.example` to `terraform.tfvars` (not committed).
- [ ] Edit `terraform.tfvars`:
  - Set `project_id = "ttf-restaurant-prod"` (or your actual prod project ID).
  - Set `state_bucket_name = "ttf-tfstate-prod"` (must be globally unique; if taken, append a suffix like `-sjh`).
  - Set `terraform_admin_email = "your-email@example.com"` (your Google account for Terraform SA impersonation).
- [ ] From the repo root, run:
  ```bash
  docker compose run --rm terraform -chdir=bootstrap init
  docker compose run --rm terraform -chdir=bootstrap plan
  docker compose run --rm terraform -chdir=bootstrap apply
  ```
- [ ] After apply, copy the backend config snippet to `infra/terraform/environments/prod/backend.tf`:
  ```bash
  cp infra/terraform/environments/prod/backend.tf.example infra/terraform/environments/prod/backend.tf
  ```
- [ ] Edit `backend.tf` and verify the bucket name matches `ttf-tfstate-prod` (or your chosen name).
- [ ] Commit the updated `backend.tf` to the repository (it is already committed with the correct name).

---

## 4. Budget Alerts

Budget monitoring guards against runaway costs. Prod thresholds: $25, $50, $100.

- [ ] Navigate to `infra/terraform/environments/prod/` and copy `terraform.tfvars.example` to `terraform.tfvars` (not committed).
- [ ] Edit `terraform.tfvars`:
  - Set `project_id = "ttf-restaurant-prod"` (matching Step 1).
  - Set `enable_billing_budget = true`.
  - Set `billing_account_id = "XXXXXX-XXXXXX-XXXXXX"` (your actual billing account ID).
  - Set `budget_amount_usd = 100` (total monthly budget).
  - Set `budget_notification_emails = ["your-email@example.com"]` (list of alert recipients).
- [ ] Thresholds (25% / 50% / 100% → $25 / $50 / $100) are fixed in `environments/prod/main.tf`'s `module.budget_alert` call — not a tfvars setting. Change there if a different split is needed.

---

## 5. Firebase Project Linkage

Firebase must be linked to the new `ttf-restaurant-prod` GCP project as a separate project (not shared with dev).

- [ ] Open [Firebase Console](https://console.firebase.google.com).
- [ ] Click **Add project** → select `ttf-restaurant-prod` from the GCP project dropdown.
- [ ] Choose **Blaze plan** (required for production workloads; dev used Spark).
- [ ] Link to your billing account (same as GCP billing).
- [ ] On **Firebase → Build → Authentication**, enable:
  - [ ] **Apple Sign-In** (copy team ID and private key from Apple Developer; same key as dev).
  - [ ] **Email/Password** (for fallback testing).
  - [ ] **Google Sign-In** (OAuth credentials created in Step 6).
- [ ] Verify **Identity Platform** is enabled (or upgrade if not yet enabled).

---

## 6. Secrets & Service Accounts

Manual secret setup and GitHub Environment configuration. Service accounts are created by Terraform; secrets are populated via CI or manually.

### 6.1 Maps API Key

- [ ] In [Google Cloud Console](https://console.cloud.google.com), go to `ttf-restaurant-prod`.
- [ ] Navigate to **APIs & Services → Credentials**.
- [ ] Create a new API key restricted to **Geocoding** and **Places** APIs (server-side only; no referrer limits).
- [ ] Copy the key value.
- [ ] In the GCP Console, go to **Security → Secret Manager**.
- [ ] Create a secret named `ttf-maps-api-key` (Secret Manager creates the container).
- [ ] Add a version: paste the Maps API key value.
- [ ] Grant the `ttf-api-runtime` service account (created by Terraform) **Secret Accessor** permission (done by Terraform `iam.tf`; verify after Step 8).

### 6.2 Firebase Admin Service Account

After Terraform creates the Firebase Admin SA:

- [ ] Run the provided script to upload the Firebase Admin SA JSON:
  ```bash
  api/scripts/upload_firebase_admin_sa.sh ttf-firebase-admin-sa ttf-restaurant-prod
  ```
  (This creates the secret and populates it with the SA credentials.)
- [ ] Verify in **Secret Manager** that `ttf-firebase-admin-sa` exists and contains valid JSON.

### 6.3 IAP OAuth Client

Identity-Aware Proxy requires an OAuth 2.0 client created manually (Terraform API is deprecated).

- [ ] In [GCP Console → Security → Identity-Aware Proxy](https://console.cloud.google.com/security/iap?project=ttf-restaurant-prod), ensure **OAuth consent screen** is configured:
  - [ ] Type: **External**
  - [ ] App name: `TTF Admin (Prod)`
  - [ ] Support email: your email
  - [ ] Developer contact: your email
- [ ] On the **IAP** tab, find the backend `ttf-prod-admin-backend` (created by Terraform in Step 8).
- [ ] Toggle **IAP ON**.
- [ ] Create OAuth client:
  - [ ] Authorized redirect URIs: `https://admin.littlescout.app/auth/callback` (add to the auto-generated client).
  - [ ] Copy the **Client ID** and **Client Secret**.
- [ ] Store in **Secret Manager**:
  - [ ] Create secret `ttf-iap-oauth` with version containing JSON: `{"client_id": "...", "client_secret": "..."}`
  - [ ] Or use GitHub Environment secrets (next step) — Terraform reads from there during apply.

### 6.4 GitHub Environment: `prod`

Configure a GitHub Environment to gate prod Terraform applies and supply secrets to CI.

- [ ] Go to **GitHub → samueljoeharris/restaurant_app → Settings → Environments → New environment**.
- [ ] Name: `prod`.
- [ ] **Deployment branches**: select **Selected branches** → add `main`.
- [ ] **Required reviewers**: check **Require reviewers** → add yourself or a trusted reviewer. (Prod `terraform apply` requires human approval.)
- [ ] **Environment secrets** (add the following; they are used by CI):

  | Secret Name | Value |
  |-------------|-------|
  | `GCP_WORKLOAD_IDENTITY_PROVIDER` | From `terraform output github_workload_identity_provider` (prod Terraform outputs after Step 8) |
  | `GCP_TERRAFORM_SERVICE_ACCOUNT` | `ttf-github-terraform@ttf-restaurant-prod.iam.gserviceaccount.com` |
  | `GCP_DEPLOY_SERVICE_ACCOUNT` | `ttf-github-deploy@ttf-restaurant-prod.iam.gserviceaccount.com` |
  | `IAP_OAUTH_CLIENT_ID` | From Step 6.3 OAuth client |
  | `IAP_OAUTH_CLIENT_SECRET` | From Step 6.3 OAuth client |
  | `BILLING_ACCOUNT_ID` | `XXXXXX-XXXXXX-XXXXXX` |

- [ ] Save the environment.

---

## 7. DNS Records for littlescout.app

Route traffic from domain names to the production load balancer. A records point at the load balancer IP created by Terraform.

- [ ] (One-time domain verification, if not already done for dev):
  - [ ] Open [Google Search Console](https://search.google.com/search-console) → **Add property** → `littlescout.app` (domain, not subdomain).
  - [ ] Choose **Domain** verification → copy the **TXT record**.
  - [ ] In [GoDaddy DNS management](https://dcc.godaddy.com/manage/littlescout.app/dns) → **Add record**:
    - [ ] Type: **TXT**, Name: `@`, Value: `google-site-verification=...`, TTL: 600.
  - [ ] Verify in Search Console (may take minutes).
- [ ] After Terraform apply (Step 8), get the load balancer IP:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod output load_balancer_ip
  ```
- [ ] In [GoDaddy DNS](https://dcc.godaddy.com/manage/littlescout.app/dns), create A records (or update if migrating from dev):

  | Type | Host | Value | TTL |
  |------|------|-------|-----|
  | A | `app` | `<load_balancer_ip>` | 600 |
  | A | `api` | `<load_balancer_ip>` | 600 |
  | A | `admin` | `<load_balancer_ip>` | 600 |

- [ ] (Optional) Create an apex forwarder:
  - [ ] In GoDaddy → **Forwarding** → `littlescout.app` → 301 redirect to `https://app.littlescout.app`.
- [ ] Verify propagation (DNS may take up to 48 hours; check with `dig app.littlescout.app`):
  ```bash
  dig app.littlescout.app
  # Expected: A record pointing at load_balancer_ip
  ```
- [ ] See [docs/LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) for SSL certificate status and troubleshooting.

---

## 8. Terraform Apply Sequence

Apply Terraform modules in order. Prod Terraform is in `infra/terraform/environments/prod/`. Edit `ci.tfvars` (committed) or `terraform.tfvars` (local, .gitignored) to control which resources are enabled.

### 8.1 Phase A — Foundation (no compute cost)

- [ ] Ensure `terraform.tfvars` is configured from Step 3 (or use committed `ci.tfvars`).
- [ ] In `terraform.tfvars`, set:
  ```hcl
  enable_cloud_sql = false
  enable_cloud_run = false
  enable_custom_domains = false
  enable_admin_cloud_run = false
  enable_admin_iap = false
  ```
- [ ] From repo root:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod init
  docker compose run --rm terraform -chdir=environments/prod plan -var-file=ci.tfvars
  # Review the plan output
  docker compose run --rm terraform -chdir=environments/prod apply -var-file=ci.tfvars
  ```
- [ ] Verify outputs:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod output
  ```
  Note: `github_workload_identity_provider` (for Step 6.4), `github_terraform_service_account`, `github_deploy_service_account`.

### 8.2 Phase B — Cloud SQL & Cloud Run API

- [ ] Build and push the `ttf-api` Docker image to Artifact Registry (created by Phase A):
  ```bash
  # From repo root; assumes Docker login to Artifact Registry
  docker build -t us-central1-docker.pkg.dev/ttf-restaurant-prod/ttf-containers/ttf-api:latest api/
  docker push us-central1-docker.pkg.dev/ttf-restaurant-prod/ttf-containers/ttf-api:latest
  ```
- [ ] In `terraform.tfvars`, set:
  ```hcl
  enable_cloud_sql = true
  enable_cloud_run = true
  api_image = "us-central1-docker.pkg.dev/ttf-restaurant-prod/ttf-containers/ttf-api:latest"
  ```
- [ ] Apply:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod apply -var-file=ci.tfvars
  ```
- [ ] Verify Cloud SQL and Cloud Run are running:
  ```bash
  gcloud run services describe ttf-api --project=ttf-restaurant-prod
  gcloud sql instances describe ttf-db --project=ttf-restaurant-prod
  ```

### 8.3 Custom Domains & Load Balancer

- [ ] Complete DNS propagation (Step 7) before enabling custom domains.
- [ ] In `terraform.tfvars`, set:
  ```hcl
  enable_custom_domains = true
  ```
- [ ] Apply:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod apply -var-file=ci.tfvars
  ```
- [ ] Wait for the managed SSL certificate to transition from `PROVISIONING` to `ACTIVE` (usually 5–15 minutes once DNS is correct):
  ```bash
  gcloud compute ssl-certificates list --project=ttf-restaurant-prod --global
  ```

### 8.4 Admin Cloud Run & IAP

- [ ] Populate secrets from Step 6:
  - [ ] `ttf-maps-api-key` in Secret Manager
  - [ ] `ttf-iap-oauth` in Secret Manager
  - [ ] `ttf-firebase-admin-sa` via the upload script
- [ ] In `terraform.tfvars`, set:
  ```hcl
  enable_admin_cloud_run = true
  enable_admin_iap = true
  ```
- [ ] Apply:
  ```bash
  docker compose run --rm terraform -chdir=environments/prod apply -var-file=ci.tfvars
  ```
- [ ] Verify IAP is enabled on the admin backend:
  ```bash
  gcloud compute backend-services list --global --project=ttf-restaurant-prod | grep admin
  ```

### 8.5 Production CI Approval Gate (Recommended)

For future `infra/**` pushes to `main`, use the GitHub Environment `prod` to gate `terraform apply`:

- [ ] In `.github/workflows/reusable-terraform.yml`, ensure the prod apply step requires the `prod` environment.
- [ ] On next `infra/**` push to `main`, GitHub Actions will pause at **apply**, waiting for approval from a required reviewer.
- [ ] A reviewer approves the deployment from **Actions → <workflow_run> → Review deployments**.
- [ ] `terraform apply` runs with the `prod` environment secrets.

*(This workflow step is not yet implemented; it is a recommendation for preventing accidental prod changes.)*

---

## 9. Smoke Tests

Verify that the production stack is live and responding correctly.

- [ ] **API health:**
  ```bash
  curl -I https://api.littlescout.app/health
  # Expected: HTTP 200 OK
  ```
- [ ] **Web app loads:**
  - [ ] Open `https://app.littlescout.app` in a browser.
  - [ ] Map loads, restaurant list appears.
  - [ ] No CORS errors in browser console.
- [ ] **CSP (Content-Security-Policy):**
  - [ ] On `https://app.littlescout.app` and `https://admin.littlescout.app`, open the browser console and confirm **no CSP violation errors** during: initial load, sign-in, map view, and a restaurant rating/submission flow.
  - [ ] If a CSP error appears, note the blocked origin and add it to the `Content-Security-Policy` `add_header` in `web/nginx.conf` / `web/nginx.admin.conf` (then rebuild/redeploy the web/admin images).
- [ ] **Privacy policy is public:**
  - [ ] Open `https://app.littlescout.app/privacy` in a private/incognito window (signed out) and confirm the page renders **without redirecting to login**.
- [ ] **Sign-in flow:**
  - [ ] Click "Sign In" → Apple/Email sign-in works.
  - [ ] After auth, user returns to the app.
- [ ] **Admin console (IAP):**
  - [ ] Visit `https://admin.littlescout.app/`.
  - [ ] IAP redirects to `accounts.google.com` (HTTP 302 redirect, not a 502 error).
  - [ ] Sign in with your Google account.
  - [ ] After IAP + Firebase auth, admin dashboard loads (stats visible at `/v1/admin/stats`).
- [ ] **iOS TestFlight / App Store build (if ready):**
  - [ ] Update the app's API base URL to `https://api.littlescout.app`.
  - [ ] Rebuild and deploy to TestFlight / App Store Connect.
  - [ ] Test sign-in, map, and TTF submission on a real device or simulator.
  - [ ] Verify network calls reach `https://api.littlescout.app` (use Xcode Network Inspector or Charles Proxy).

---

## 10. Rollback Plan

If production encounters critical issues, these steps restore service to the dev pilot.

- [ ] **Keep dev project live:** Do not tear down `ttf-restaurant-dev`. DNS remains in dev's load balancer IP for rollback.
- [ ] **DNS revert (fastest):**
  - [ ] In GoDaddy DNS, change A records (`app`, `api`, `admin`) back to `ttf-restaurant-dev`'s load balancer IP.
  - [ ] Wait for propagation (usually minutes at TTL 600).
  - [ ] Traffic routes back to dev; users see the pilot.
- [ ] **API rollback:**
  - [ ] Revert the API image in prod Cloud Run to a known-good version, or redeploy from dev.
  - [ ] Or use Cloud SQL automated backups to restore data if corruption occurred.
- [ ] **Terraform state protection:**
  - [ ] Prod Cloud SQL has `deletion_protection = true`, preventing accidental destroy.
  - [ ] If you must destroy prod Cloud Run, set `deletion_protection = false` in Terraform first, then destroy.
  - [ ] Cloud SQL automated backups are retained; use GCP Console or `gcloud sql backups` to restore.
- [ ] **Data recovery:**
  - [ ] Cloud SQL automated backups run daily; restore via GCP Console **SQL Instances → ttf-db → Backups** → **Restore**.
  - [ ] Export recent data to GCS if needed.

---

## Related Docs

- **[docs/DESIGN.md](DESIGN.md)** — naming conventions, service account formats (`ttf-api-runtime@ttf-restaurant-prod.iam`), budget thresholds.
- **[docs/LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md)** — dev equivalent runbook; structure, DNS troubleshooting, IAP setup, SSL status.
- **[docs/GETTING_STARTED.md](GETTING_STARTED.md)** — local dev setup, account checklist, developer environment.
- **[infra/terraform/README.md](../infra/terraform/README.md)** — Terraform directory layout, Phase A/B, Workload Identity Federation, CI triggers, cost notes.
- **[infra/terraform/environments/prod/](../infra/terraform/environments/prod/)** — prod Terraform config, backend, variables, outputs.
- **[infra/terraform/bootstrap/](../infra/terraform/bootstrap/)** — one-time Terraform state bucket bootstrap.
