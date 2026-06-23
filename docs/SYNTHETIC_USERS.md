# Synthetic agent users

Browser-based simulation of parent activity on **app.dev** using **Cursor Automations** and Cloud Agent desktop browser control.

**Decisions (locked in):**

- Slack channel: `#little-scout`
- Email pattern: `scout-agent-{nn}@littlescout.app`
- Synthetic data counts toward app.dev aggregates (dev-only; prod will not run these agents)
- Users tagged with Firebase custom claim `synthetic: true`

## What this does

| Scenario | Description |
|----------|-------------|
| `signup` | Create email/password account, tag synthetic, add to registry |
| `search` | Sign in, search map / typeahead, open a restaurant |
| `submit_ttf` | Submit random valid TTF observation |
| `update_ttf` | Edit an existing observation for a known agent user |

Playbook: [`.cursor/skills/synthetic-user/SKILL.md`](../.cursor/skills/synthetic-user/SKILL.md)

## Prerequisites

1. **Cloud Agent environment** — [Little Scout Cloud Agent V1](../.cursor/environment.json) with Runtime Secret `GCP_DEV_SYNC_SA_JSON` ([docs/CLOUD_AGENT.md](CLOUD_AGENT.md))
2. **Slack** — Cursor Slack integration connected; public channel `#little-scout`
3. **Secret Manager** — `ttf-agent-users-registry` seeded (see below)
4. **Firebase** — synthetic emails must not have MFA enabled

## Agent registry (Secret Manager)

Secret ID: `ttf-agent-users-registry`

Initial seed:

```bash
echo '{
  "email_domain": "littlescout.app",
  "email_prefix": "scout-agent",
  "next_index": 1,
  "users": []
}' | gcloud secrets versions add ttf-agent-users-registry --project=ttf-restaurant-dev --data-file=-
```

After `./scripts/sync-secrets.sh`, the registry is at `.secrets/agent-users-registry.json`.

CLI:

```bash
python3 scripts/synthetic-users/registry.py list
python3 scripts/synthetic-users/registry.py next-email
python3 scripts/synthetic-users/registry.py pick-user
python3 scripts/synthetic-users/registry.py pick-user --with-observations
python3 scripts/synthetic-users/registry.py add-user --email '...' --password '...' --uid '...'
python3 scripts/synthetic-users/registry.py record-observation --email '...' --observation-id '...'
python3 scripts/synthetic-users/registry.py random-ttf
```

Tag user after signup:

```bash
./scripts/run-api-script.sh set_synthetic_claim.py --email scout-agent-01@littlescout.app
```

## Cursor Automations setup

Create automations at [cursor.com/automations/new](https://cursor.com/automations/new).

**Scheduled signup (start here):** full spec in [SYNTHETIC_USERS_SIGNUP_AUTOMATION.md](SYNTHETIC_USERS_SIGNUP_AUTOMATION.md) — automation name `scout-synthetic-signup-daily`, prompt in [`.cursor/automations/scout-synthetic-signup-daily.md`](../.cursor/automations/scout-synthetic-signup-daily.md).

**Shared settings (all automations):**

| Setting | Value |
|---------|-------|
| Repository | `samueljoeharris/restaurant_app` @ `main` |
| Environment | Little Scout Cloud Agent V1 |
| Model | Default (capable of browser use) |

### 1. `scout-synthetic-daily`

| Setting | Value |
|---------|-------|
| Trigger | Scheduled — cron `0 14 * * *` (9am US Eastern) or daily preset |
| Tools | Send to Slack |

**Prompt** — copy from [`.cursor/automations/scout-synthetic-daily.md`](../.cursor/automations/scout-synthetic-daily.md)

### 2. `scout-synthetic-slack`

| Setting | Value |
|---------|-------|
| Trigger | Slack → New message in `#little-scout` |
| Tools | Read Slack channels, Send to Slack |

**Prompt** — copy from [`.cursor/automations/scout-synthetic-slack.md`](../.cursor/automations/scout-synthetic-slack.md)

### 3. `scout-synthetic-webhook` (optional)

| Setting | Value |
|---------|-------|
| Trigger | Webhook |
| Tools | Send to Slack |

**Prompt** — copy from [`.cursor/automations/scout-synthetic-webhook.md`](../.cursor/automations/scout-synthetic-webhook.md)

Only messages containing `scout:` or `simulate` should run scenarios (enforced in prompt).

### Slack commands

```
scout: simulate signup
scout: simulate search
scout: simulate submit
scout: simulate update
scout: simulate all
```

Interactive fallback: `@Cursor simulate signup on app.dev` in Slack (route to this repo).

## Manual test (before enabling schedule)

1. Run automation **scout-synthetic-slack** manually from Cursor dashboard, or start Cloud Agent with:
   > Read `.cursor/skills/synthetic-user/SKILL.md` and run scenario `search` on app.dev. Do not commit or push.
2. Confirm Slack summary in `#little-scout`
3. Run `scout: simulate submit` from Slack

## Acceptance checklist

- [ ] `scout-synthetic-daily` runs 3 days in a row with Slack summary
- [ ] `scout: simulate submit` triggers and replies in thread
- [ ] Signup → search → submit → edit path works for one agent user
- [ ] Firebase shows `synthetic: true` on agent accounts
- [ ] Failures include screenshot in Slack

## Observability (optional)

- **Audit log:** Cursor Automations run history in dashboard
- **Webhook trigger:** add Webhook trigger to `scout-synthetic-slack` for external POST (e.g. monitoring); payload can include `scenario` field — document in automation prompt
- **Admin debug:** list synthetic users in Firebase Console → Authentication

## Security

- Passwords live in Secret Manager only
- Max 3 scenarios per run
- Respects API rate limits (60 writes/hour/user)
- Automations must not push code — browser testing only
- Network allowlist on Cloud Agent VM per [CLOUD_AGENT.md](CLOUD_AGENT.md)

## Related

- [SECRETS_MATRIX.md](SECRETS_MATRIX.md) — `ttf-agent-users-registry`
- [WEB_AUTH.md](WEB_AUTH.md) — Firebase auth on app.dev
