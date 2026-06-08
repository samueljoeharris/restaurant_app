output "enabled_services" {
  description = "List of enabled API service names"
  value       = [for s in google_project_service.services : s.service]
}
