# Secrets & runtime audit — 2026-06-20

Audit of the secrets/env-var design and its runtime (Docker) consistency across
local Mac, Cursor Cloud VM, GitHub Actions, and Cloud Run.

**Verdict:** the secrets design is sound — GSM is genuinely authoritative and the
dead-drop pattern is consistent. The inconsistencies live in the **runtime/parity
layer** (Docker), not the secrets layer. See [SECRETS_MATRIX.md](SECRETS_MATRIX.md)
for the operational reference.

---

## 1. Design as actually wired

GCP Secret Manager is the source of truth, with
[`catalog.tf`](../infra/terraform/modules/secrets/catalog.tf) as the in-code
inventory. A dead-drop courier ([`sync-secrets.sh`](../scripts/sync-secrets.sh))
writes gitignored files that the apps read. The four consumers authenticate to
GSM differently but land secrets the same way.

```
GCP Secret Manager (authoritative; catalog.tf = inventory)
   ├── Local Mac        gcloud ADC ──────────── sync-secrets.sh → .secrets/*
   ├── Cursor Cloud VM  pasted SA key ────────── sync-secrets.sh → .secrets/*
   ├── GitHub Actions   WIF (keyless) ────────── gcloud secrets access → build-args
   └── Cloud Run        runtime SA + IAM ─────── Terraform secret_env + file mount
```

| Surface | Auth to GSM | Delivery | Dead drop |
|---|---|---|---|
| Local Mac | gcloud ADC (user creds) | `sync-secrets.sh` → `.secrets/*`, `web/.env.local` | yes |
| Cursor Cloud VM | one pasted SA key `GCP_DEV_SYNC_SA_JSON` | same `sync-secrets.sh` | yes |
| GitHub Actions | Workload Identity Federation (keyless) | `gcloud secrets access` → web build-args; API gets none at build | partial |
| Cloud Run | runtime SA + IAM | Terraform `secret_env` + file mount (no `.secrets/`) | yes (direct) |

**Controls that are working well:**

- `.secrets/` is `chmod 700`, gitignored.
- `sync_dev=false` keeps infra/prod secrets (DB URL, IAP OAuth, internal job
  token) off all dev machines.
- Dev-sync SA has `secretAccessor` only on `sync_dev=true` secrets (least privilege).
- Deployed-mode guard in [`security_config.py`](../api/ttf_api/security_config.py)
  fails startup if `AUTH_DEV_MODE=true` on Cloud Run / Cloud SQL — defense in
  depth against a Terraform typo.
- Gitleaks scan on pre-push and in CI.

---

## 2. Do we rely on Docker locally (Mac + Cloud VM)?

**Postgres only in Docker locally; API runs natively via uvicorn** (see remediation below).

- Mac — [`start-local.sh`](../scripts/start-local.sh): `docker compose up postgres` + `./scripts/run-api.sh`
- Cloud VM — [`cloud-eval-up.sh`](../.cursor/scripts/cloud-eval-up.sh):
  `start-docker.sh` (Postgres only) + native `./scripts/run-api.sh`

Legacy `--docker-api` / `docker compose up postgres api` still available.

| Component | Local dev | Production | Dev/prod parity |
|---|---|---|---|
| API | Native uvicorn (optional Docker via `--docker-api`) | Container (Cloud Run) | medium — same code path |
| Postgres | Docker (compose) | Cloud SQL (managed) | medium |
| Web / admin | `npm run dev`, **native, no Docker** | Container (Cloud Run nginx) | **low** |
| Firebase Auth | managed service (emulator optional) | managed service | n/a — never containerized |

So: **Postgres relies on Docker locally; API is native by default; web does not; Firebase Auth never does.**

## 3. Are containers "the main thing"?

In production, **all three app surfaces (API, web, admin) are Cloud Run
containers.** Firebase is **not** a container or hosting surface here — it is only
the **auth provider** (managed), consumed via the Admin SA for JWT verification.
`firebase.json` configures emulators only; the web is nginx-on-Cloud-Run, not
Firebase Hosting.

> Containers are the production runtime unit. Firebase is identity. Postgres is
> managed Cloud SQL. Local Docker mirrors production for the API, partially for
> Postgres, and not at all for web.

---

## 4. Findings (ranked)

### 🔴 Cloud-VM Docker-in-Docker is the most fragile link

[`start-docker.sh`](../.cursor/scripts/start-docker.sh) is ~84 lines of `dockerd`
wrangling — fuse-overlayfs, iptables-legacy, manual socket ACLs, and a fallback
that launches `dockerd` by hand. It exists only to run the API in a container on
the VM. The API already runs natively in CI (uvicorn import smoke, no Docker).
Highest-maintenance, lowest-value part of the system.

### 🟠 Web has the least dev/prod parity; API has the most

API is containerized identically in dev and prod; web runs as a native Vite dev
server locally but ships as an nginx container. Defensible (Vite HMR in Docker is
painful), but it means "we use Docker for local dev" is only half true.

### 🟠 `firebase-sa.json` path — **remediated**

Canonical local path: `.secrets/firebase-sa.json` only. Cloud Run keeps
`/secrets/firebase-admin/firebase-sa.json` inside the container.

### 🟡 "Secrets" vs public config — **remediated**

See [SECRETS_MATRIX.md](SECRETS_MATRIX.md) confidential / public-build / deploy-config sections.

### 🟡 Three GSM auth mechanisms (ADC / SA key / WIF)

Inherent to the platforms, not a flaw. But the pasted `GCP_DEV_SYNC_SA_JSON` is
the one secret the dead-drop cannot eliminate: long-lived, and on personal GCP
there is no org policy to enforce rotation (rotation is script + calendar
discipline). It is the highest-value standing credential in the dev path. GitHub
already does this right with keyless WIF; the Cloud VM is the weak point.

---

## 5. Recommendations

The GSM/catalog/dead-drop core is sound — leave it. The work worth doing
decouples local dev from Docker-in-Docker, which also fixes the parity story.

1. **Add a native API fast-path** (`uvicorn ttf_api.main:app`) for Mac and Cloud
   VM, keeping Postgres as the only container (or use `cloud-sql-proxy`). Deletes
   the fragile `start-docker.sh` dependency; the API still matches the Cloud Run
   image (same code + same `.secrets/api.env`).
2. **Pick one SA-file path** so native and Docker agree; drop the repo-root copy
   if the native path can read from `.secrets/`.
3. **Split the matrix** into "true secrets" vs "public build-time config."

### Status

| # | Recommendation | Status |
|---|---|---|
| 1 | Native API fast-path (remove DinD dependency) | **done** |
| 2 | Single `firebase-sa.json` path | **done** |
| 3 | Mark public build-time config distinctly in the matrix | **done** |

See [SECRETS_AUDIT_REMEDIATION_CHECKLIST.md](SECRETS_AUDIT_REMEDIATION_CHECKLIST.md) for post-merge verification.

---

## Related

- [SECRETS_MATRIX.md](SECRETS_MATRIX.md) — operational reference (inventory, rotation)
- [SECRETS_AUDIT_REMEDIATION_CHECKLIST.md](SECRETS_AUDIT_REMEDIATION_CHECKLIST.md) — post-merge verification
- [CLOUD_AGENT.md](CLOUD_AGENT.md) — Cursor one-secret setup
