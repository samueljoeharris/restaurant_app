output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "database_name" {
  value = google_sql_database.main.name
}

output "database_user" {
  value = google_sql_user.app.name
}

output "database_password" {
  value     = random_password.db_password.result
  sensitive = true
}

output "public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}
