output "lb_ip_address" {
  description = "Global static IPv4 — create GoDaddy A records pointing here"
  value       = google_compute_global_address.lb_ip.address
}

output "ssl_certificate_name" {
  value = google_compute_managed_ssl_certificate.cert.name
}

output "backend_service_ids" {
  value = { for k, v in google_compute_backend_service.backend : k => v.id }
}

output "backend_service_names" {
  value = { for k, v in google_compute_backend_service.backend : k => v.name }
}
