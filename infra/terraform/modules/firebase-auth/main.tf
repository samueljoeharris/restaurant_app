terraform {
  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = var.project_id

  authorized_domains = var.authorized_domains

  monitoring {
    request_logging {
      enabled = true
    }
  }

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  mfa {
    state = var.mfa_state

    provider_configs {
      state = var.mfa_state == "DISABLED" ? "DISABLED" : "ENABLED"

      totp_provider_config {
        adjacent_intervals = 5
      }
    }
  }
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.enable_google_sign_in && var.google_oauth_client_id != "" ? 1 : 0

  provider      = google-beta
  project       = var.project_id
  idp_id        = "google.com"
  enabled       = true
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.auth]
}
