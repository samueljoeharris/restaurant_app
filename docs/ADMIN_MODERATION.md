# Admin moderation operator runbook

Operator console at `admin.dev.littlescout.app` (IAP + Firebase admin claim).

## Daily workflow

1. **Overview** — check attention cards; pending moderation is the primary queue.
2. **Moderation** — approve trusted-looking submissions; reject spam; escalate edge cases.
3. **Data & observations** — exclude mistaken speed entries from venue medians.
4. **Contributors** — promote repeat helpful parents to **Trusted + auto-publish**; disable abusive accounts.
5. **Restaurants** — fix addresses, merge duplicate venues, adjust status.

## Trust tiers

| Tier | Behavior |
|------|----------|
| New | Submissions queued until operator approve (default) |
| Standard | Queued unless auto-publish enabled |
| Trusted | Auto-publish; still reportable |
| Restricted | Firebase disabled; writes blocked |

## Location seeding

Under **Tools → Location seeding** (`/admin/tools/locations`). Unchanged from prior admin — catalog refresh only.

## API

Moderation settings: `GET /v1/admin/settings/moderation`  
Attention counts: `GET /v1/admin/attention`  
Public reports: `POST /v1/reports`

See [ADMIN_AUTH.md](ADMIN_AUTH.md) for auth layers.
