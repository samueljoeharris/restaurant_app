output "budget_name" {
  value = google_billing_budget.this.display_name
}

output "budget_id" {
  value = google_billing_budget.this.id
}

output "notification_channel_ids" {
  value = [for c in google_monitoring_notification_channel.email : c.id]
}
