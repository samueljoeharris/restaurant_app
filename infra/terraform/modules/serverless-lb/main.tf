terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

resource "google_compute_global_address" "lb_ip" {
  name         = "${var.name_prefix}-lb-ip"
  project      = var.project_id
  address_type = "EXTERNAL"
}

resource "google_compute_managed_ssl_certificate" "cert" {
  name    = "${var.name_prefix}-cert"
  project = var.project_id

  managed {
    domains = var.ssl_domains
  }
}

resource "google_compute_region_network_endpoint_group" "neg" {
  for_each = var.backends

  name                  = "${var.name_prefix}-${each.key}-neg"
  project               = var.project_id
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = each.value.cloud_run_service
  }
}

resource "google_compute_backend_service" "backend" {
  for_each = var.backends

  name                  = "${var.name_prefix}-${each.key}-backend"
  project               = var.project_id
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.neg[each.key].id
  }

  dynamic "iap" {
    for_each = each.value.enable_iap && var.iap_oauth_client_id != "" ? [1] : []
    content {
      oauth2_client_id     = var.iap_oauth_client_id
      oauth2_client_secret = var.iap_oauth_client_secret
    }
  }
}

resource "google_compute_url_map" "https" {
  name            = "${var.name_prefix}-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.backend[var.default_backend_key].id

  dynamic "host_rule" {
    for_each = var.host_routes
    content {
      hosts        = [host_rule.value.hostname]
      path_matcher = host_rule.value.backend_key
    }
  }

  dynamic "path_matcher" {
    for_each = var.backends
    content {
      name            = path_matcher.key
      default_service = google_compute_backend_service.backend[path_matcher.key].id
    }
  }
}

resource "google_compute_target_https_proxy" "https" {
  name             = "${var.name_prefix}-https-proxy"
  project          = var.project_id
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.cert.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.name_prefix}-https-rule"
  project               = var.project_id
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.https.id
  ip_address            = google_compute_global_address.lb_ip.id
}

resource "google_compute_url_map" "http_redirect" {
  name    = "${var.name_prefix}-http-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http" {
  name    = "${var.name_prefix}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${var.name_prefix}-http-rule"
  project               = var.project_id
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "80"
  target                = google_compute_target_http_proxy.http.id
  ip_address            = google_compute_global_address.lb_ip.id
}
