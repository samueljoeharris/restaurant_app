# Synthetic agent users

Simulation of parent activity on **dev** (never prod) via two coexisting implementations:

1. **In-repo package (#89)** — `scripts/synthetic-users/synthetic_users/`, API-first, off by default. See [In-repo package](#in-repo-package-89) below.
2. **Cursor Automations** — browser-based, using Cloud Agent desktop browser control. See [Cursor Automations setup](#cursor-automations-setup) below.

Both share the same registry (`scripts/synthetic-users/registry.py`, Secret Manager `ttf-agent-users-registry`) and identity scheme, so agent users created by either path show up to the other.

**Decisions (locked in):**

- Slack channel: `#little-scout`
- Email pattern: `scout-agent-{nn}@littlescout.app`
- Synthetic data counts toward app.dev aggregates (dev-only; prod will not run these agents)
- Users tagged with Firebase custom claim `synthetic: true`

## In-repo package (#89)

`scripts/synthetic-users/synthetic_users/` is a runnable Python package — scenario runners, personas, two drivers, structured JSONL logs, a local CLI, and a `workflow_dispatch`-only GitHub Actions workflow. **Nothing in it runs on a schedule.** A human always kicks off a run.

### Scenarios

| Scenario | What it does |
|----------|--------------|
| `signup` | Firebase email/password sign-up, tag `synthetic: true` (via `api/scripts/set_synthetic_claim.py`), register in the registry |
| `search` | Sign in, search restaurants, open one |
| `submit_ttf` | Submit a random-but-plausible TTF observation |
| `update_ttf` | Edit an existing observation for a user with prior observations |
| `rate_attributes` | Rate one community attribute (boolean/enum/numeric, matching `/v1/metrics`) |
| `post_note` | Post a short freeform note |
| `review_chat` | Chat-through-your-review: reply loop → extract a draft → submit contributions |
| `team` | Runs N personas concurrently across the default rotation (`search`, `submit_ttf`, `rate_attributes`, `post_note`), each with jittered pacing |

### Personas

Five hand-picked personas in `synthetic_users/personas.py` (`toddler_lunch`, `big_family_weekend`, `early_riser`, `after_school`, `date_night_plus_kid`) vary family size, kids' ages, cuisine bias, daypart bias, and contribution style, so generated data reads as plausible variety rather than uniform noise. `--agents N` assigns personas round-robin and deterministically (same N always yields the same mix).

### Drivers

- **`--driver api`** (default) — Firebase email/password sign-in → ID token → real `/v1` endpoints via stdlib `urllib` (no third-party HTTP dependency). Covers all seven scenarios.
- **`--driver browser`** (optional) — Playwright, the true UI path, covering `signup`/`search`/`submit_ttf`/`update_ttf` (the four scenarios already documented for manual/Cursor use below). Requires `pip install playwright && playwright install chromium`. `rate_attributes`/`post_note`/`review_chat` raise `NotImplementedError` pointing back to `--driver api`.

### Guardrails (hard-coded, not configurable)

- `--target` only accepts `dev`; `synthetic_users/config.py` resolves it to `app.dev.littlescout.app` / `api.dev.littlescout.app` / `ttf-restaurant-dev` — there is no override flag for these URLs
- `synthetic_users/guardrails.py` re-checks every resolved host ends with `.dev.littlescout.app` and the GCP project is exactly `ttf-restaurant-dev`
- Every registry email must match the `scout-agent-{nn}@littlescout.app` scheme (`assert_synthetic_email`) — enforced on both `next_email()` and `add_user()`
- `signup` always tags the new account `synthetic: true` via `api/scripts/set_synthetic_claim.py` before registering it

### Running it locally

```bash
cd scripts/synthetic-users

# Safe with no secrets at all — logs intended calls, no network access:
python3 -m synthetic_users run --scenario team --agents 5 --target dev --dry-run

# Real run against dev (needs FIREBASE_API_KEY — see below):
export FIREBASE_API_KEY="$(grep VITE_FIREBASE_API_KEY ../../web/.env.local | cut -d= -f2-)"
python3 -m synthetic_users run --scenario team --agents 5 --target dev

# One scenario, browser driver:
python3 -m synthetic_users run --scenario submit_ttf --target dev --driver browser
```

`FIREBASE_API_KEY` (or `VITE_FIREBASE_API_KEY`, already synced to `web/.env.local` by `./scripts/sync-secrets.sh`) is the web Firebase API key — needed for the Identity Toolkit REST sign-up/sign-in calls. `signup` additionally needs `.secrets/firebase-sa.json` (same file used by `api/scripts/set_synthetic_claim.py`), via `./scripts/sync-secrets.sh`.

Run logs land in `scripts/synthetic-users/runs/*.jsonl` (git-ignored) — one JSON object per action, plus a stdout summary from `RunLogger.summary()`.

### Running via GitHub Actions

[`tool-synthetic-users.yml`](../.github/workflows/tool-synthetic-users.yml) is **`workflow_dispatch`-only — no schedule**. Trigger it from the Actions tab with `scenario`, `agents`, `driver`, and `dry_run` inputs. `dry_run` defaults to `true`, so a first run is always safe. For a real run, add repo secrets `FIREBASE_API_KEY` and (for `signup`) `FIREBASE_SERVICE_ACCOUNT_JSON` (base64-encoded service account JSON, same shape as `IOS_GOOGLE_SERVICE_INFO_PLIST` in `tool-ios.yml`).

**Known limitation:** the Actions runner doesn't sync the registry from Secret Manager, so each real (non-dry-run) run starts from an empty registry unless `--registry` points at a checked-out/synced file. Wiring the registry through Secret Manager sync in CI is tracked as follow-up, not required for this to be safely runnable on demand.

### Tests

Pure logic only (no network, no secrets needed):

```bash
cd scripts/synthetic-users
python3 -m pytest -q
```

Covers persona generation/determinism, guardrail checks (dev-host acceptance/rejection, synthetic email scheme), registry read/write round-tripping against the sibling `registry.py` file format, JSONL log formatting, target resolution, and the team orchestrator's scenario dispatch/rotation (via injected fake scenario modules — still no network).

### Package layout

```
scripts/synthetic-users/
  registry.py                 # existing CLI — unchanged, still the format's source of truth
  synthetic_users/
    cli.py                    # `python -m synthetic_users run ...`
    team.py                   # concurrent orchestrator, jittered pacing, scenario rotation
    config.py                 # target resolution (dev-only, closed set)
    guardrails.py             # hard-coded dev-only + synthetic-email checks
    personas.py                # persona presets + random TTF/attribute value generation
    registry_client.py         # library wrapper over the sibling registry.py
    runlog.py                  # JSONL log events + stdout summary
    http_client.py              # stdlib HTTP helper (API driver)
    drivers/
      base.py                  # SyntheticDriver protocol
      api_driver.py             # Firebase REST + /v1 endpoints (primary)
      browser_driver.py          # optional Playwright driver
    scenarios/
      common.py                 # ScenarioResult, step() logging helper
      signup.py, search.py, submit_ttf.py, update_ttf.py,
      rate_attributes.py, post_note.py, review_chat.py
    tests/                      # pure-logic unit tests (pytest)
```

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
