# Global external HTTPS load balancer for littlescout.app dev hostnames.
# GoDaddy A records → module.serverless_lb[0].lb_ip_address (see docs/LITTLESCOUT_DOMAIN.md).

module "serverless_lb" {
  count  = var.enable_custom_domains && var.enable_cloud_run ? 1 : 0
  source = "../../modules/serverless-lb"

  project_id    = var.project_id
  region        = var.region
  name_prefix   = "ttf-${var.dns_environment}"
  ssl_domains   = local.custom_domain_hostnames
  default_backend_key = "web"

  backends = merge(
    var.enable_web_cloud_run ? {
      web = {
        cloud_run_service = module.cloud_run_web[0].service_name
        enable_iap        = false
      }
    } : {},
    {
      api = {
        cloud_run_service = module.cloud_run[0].service_name
        enable_iap        = false
      }
    },
    var.enable_admin_cloud_run ? {
      admin = {
        cloud_run_service = module.cloud_run_admin[0].service_name
        enable_iap        = var.enable_admin_iap
      }
    } : {},
  )

  host_routes = compact([
    var.enable_web_cloud_run && local.web_fqdn != "" ? {
      hostname    = local.web_fqdn
      backend_key = "web"
    } : null,
    local.api_fqdn != "" ? {
      hostname    = local.api_fqdn
      backend_key = "api"
    } : null,
    var.enable_admin_cloud_run && local.admin_fqdn != "" ? {
      hostname    = local.admin_fqdn
      backend_key = "admin"
    } : null,
  ])

  iap_oauth_client_id     = var.iap_oauth_client_id
  iap_oauth_client_secret = var.iap_oauth_client_secret

  depends_on = [
    module.project_services,
    module.cloud_run,
    module.cloud_run_web,
  ]
}

resource "google_iap_web_backend_service_iam_binding" "admin" {
  count = var.enable_custom_domains && var.enable_admin_cloud_run && var.enable_admin_iap && length(var.iap_admin_members) > 0 ? 1 : 0

  project             = var.project_id
  web_backend_service = module.serverless_lb[0].backend_service_names["admin"]
  role                = "roles/iap.httpsResourceAccessor"
  members             = var.iap_admin_members
}

resource "google_secret_manager_secret_version" "api_public_url" {
  count = var.enable_custom_domains && local.api_origin != "" ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-api-public-url"]
  secret_data = local.api_origin

  depends_on = [module.secrets]
}

resource "google_secret_manager_secret_version" "web_public_url" {
  count = var.enable_custom_domains && local.web_origin != "" ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-web-public-url"]
  secret_data = local.web_origin

  depends_on = [module.secrets]
}

resource "google_secret_manager_secret_version" "admin_public_url" {
  count = var.enable_custom_domains && var.enable_admin_cloud_run && local.admin_origin != "" ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-admin-public-url"]
  secret_data = local.admin_origin

  depends_on = [module.secrets]
}

resource "google_secret_manager_secret_iam_member" "github_deploy_api_public_url" {
  count = var.enable_custom_domains ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-api-public-url"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}

resource "google_secret_manager_secret_iam_member" "github_deploy_web_public_url" {
  count = var.enable_custom_domains ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-web-public-url"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}

resource "google_secret_manager_secret_iam_member" "github_deploy_admin_public_url" {
  count = var.enable_custom_domains && var.enable_admin_cloud_run ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-admin-public-url"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}
