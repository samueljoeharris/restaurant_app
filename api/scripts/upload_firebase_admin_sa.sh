#!/usr/bin/env bash
# Upload Firebase Admin SDK JSON to Secret Manager for Cloud Run JWT verification.
set -euo pipefail

PROJECT="${GCP_PROJECT:-ttf-restaurant-dev}"
SECRET="ttf-firebase-admin-sa"
KEY_FILE="${1:-.secrets/firebase-sa.json}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Usage: $0 [path-to-firebase-sa.json]" >&2
  echo "Download from Firebase Console → Project settings → Service accounts → Generate new private key" >&2
  exit 1
fi

gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=automatic

gcloud secrets versions add "$SECRET" --project="$PROJECT" --data-file="$KEY_FILE"
echo "Uploaded ${KEY_FILE} to projects/${PROJECT}/secrets/${SECRET}"
