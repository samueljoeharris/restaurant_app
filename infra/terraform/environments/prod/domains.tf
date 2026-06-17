# littlescout.app hostname locals — prod segment maps to ttf-restaurant-prod.

locals {
  dns_base = trimspace(var.dns_base_domain)

  # app.littlescout.app, api.littlescout.app, admin.littlescout.app
  dns_env_suffix = local.dns_base != "" ? (
    var.dns_environment == "dev" ? ".dev.${local.dns_base}" : ".${local.dns_base}"
  ) : ""

  web_fqdn   = local.dns_base != "" ? "app${local.dns_env_suffix}" : ""
  api_fqdn   = local.dns_base != "" ? "api${local.dns_env_suffix}" : ""
  admin_fqdn = local.dns_base != "" ? "admin${local.dns_env_suffix}" : ""

  web_origin   = local.web_fqdn != "" ? "https://${local.web_fqdn}" : ""
  api_origin   = local.api_fqdn != "" ? "https://${local.api_fqdn}" : ""
  admin_origin = local.admin_fqdn != "" ? "https://${local.admin_fqdn}" : ""

  custom_domain_hostnames = compact([
    local.web_fqdn,
    local.api_fqdn,
    var.enable_admin_cloud_run ? local.admin_fqdn : null,
  ])
}
