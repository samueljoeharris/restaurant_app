variable "project_id" {
  type = string
}

variable "billing_account_id" {
  type        = string
  description = "Billing account ID (XXXXXX-XXXXXX-XXXXXX)"
}

variable "display_name" {
  type    = string
  default = "ttf-budget"
}

variable "budget_amount_usd" {
  type = number
}

variable "currency_code" {
  type    = string
  default = "USD"
}

variable "threshold_percents" {
  type        = list(number)
  description = "Budget alert thresholds as fractions of budget_amount_usd (e.g. 0.5 = 50%)"
  default     = [0.5, 1.0]
}

variable "notification_emails" {
  type        = list(string)
  description = "Emails to notify via email notification channels when thresholds are crossed"
  default     = []
}
