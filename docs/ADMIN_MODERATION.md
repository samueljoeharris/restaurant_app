# Admin moderation operator runbook

Operator console at `admin.dev.littlescout.app` (IAP + Firebase admin claim).

## Daily workflow

1. **Overview** — check attention cards; pending moderation is the primary queue.
2. **Moderation** — approve trusted-looking submissions; reject spam; escalate edge cases.
3. **Data & observations** — exclude mistaken speed entries from venue medians.
4. **Contributors** — set trust tier (Trusted publishes immediately; New/Standard go to moderation queue); disable abusive accounts.
5. **Restaurants** — fix addresses, merge duplicate venues, adjust status.

## Trust tiers

| Tier | Behavior |
|------|----------|
| New | Submissions queued for operator review (first-time contributors) |
| Standard | Submissions queued for operator review |
| Trusted | Submissions publish immediately; still reportable |
| Restricted | Firebase disabled; writes blocked |

## Catalog & refresh

Under **Catalog & refresh** (`/admin/tools/locations`; formerly "Location seeding"). Leads with the refresh-locations registry (user coverage requests register here automatically); manual pre-seeding is a collapsed cold-start tool.

## API

Moderation settings: `GET /v1/admin/settings/moderation`  
Attention counts: `GET /v1/admin/attention`  
Public reports: `POST /v1/reports`

See [ADMIN_AUTH.md](ADMIN_AUTH.md) for auth layers.
