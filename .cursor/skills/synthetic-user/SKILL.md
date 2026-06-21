---
name: synthetic-user
description: >-
  Browser-based synthetic user simulation on app.dev: signup, search, TTF submit,
  and contribution edit. Use when running Cursor Automations (scout-synthetic-daily,
  scout-synthetic-slack) or when asked to simulate agent users on Little Scout.
---

# Synthetic User Simulation

Simulate realistic parent activity on **https://app.dev.littlescout.app** using the desktop browser. This is **dev-only** — prod will not run agent users.

## Hard constraints

| Rule | Detail |
|------|--------|
| **No code changes** | Do not commit, push, or edit repo files unless explicitly asked |
| **Target** | `https://app.dev.littlescout.app` only |
| **Auth** | Email/password only — never Google OAuth |
| **Max scenarios** | 3 per automation run |
| **Slack** | Post summary to `#little-scout`; reply in thread for Slack-triggered runs |
| **Failure** | Attach screenshot; describe what blocked you |

## Before each run

1. Confirm Cloud Agent env **Little Scout Cloud Agent V1** is active (bootstrap via `.cursor/scripts/bootstrap-cloud-env.sh` if needed).
2. Registry path: `.secrets/agent-users-registry.json` (from `ttf-agent-users-registry` via sync).
3. Browser viewport: **390×844** (mobile) or **1280×900** (desktop) — login and map work on both after the mobile pilot.

## Scenario rotation (daily automation)

Use weekday (Mon=0 … Sun=6 in US/Eastern or UTC):

| Day | Scenarios (in order, max 3 total) |
|-----|-----------------------------------|
| Mon, Wed, Fri | `signup` (if needed), `search`, `submit_ttf` |
| Tue, Thu | `search`, `submit_ttf`, `update_ttf` |
| Sat, Sun | `search` ×2 |

For Slack/on-demand: run only the scenario(s) requested.

## Scenario: `signup`

**Goal:** Create one new agent user and register them.

1. Generate credentials:
   ```bash
   python3 scripts/synthetic-users/registry.py next-email
   ```
2. Browser → `https://app.dev.littlescout.app/login`
3. Click **Need an account? Sign up**
4. Enter email (`scout-agent-{nn}@littlescout.app`) and password (min 6 chars)
5. Click **Create account** — expect redirect to map (`/` or `/map`)
6. Tag user in Firebase:
   ```bash
   ./scripts/run-api-script.sh set_synthetic_claim.py --email 'EMAIL'
   ```
7. Get UID from script output; update registry:
   ```bash
   python3 scripts/synthetic-users/registry.py add-user \
     --email 'EMAIL' --password 'PASSWORD' --uid 'UID'
   ```
8. **Pass:** map loads while signed in. **Fail:** error on login page or MFA prompt (synthetic users must not have MFA).

## Scenario: `search`

**Goal:** Exercise map search while signed in.

1. Pick user:
   ```bash
   python3 scripts/synthetic-users/registry.py pick-user
   ```
   If registry empty, use credentials from `.secrets/dev-test.env` or run `signup` first.
2. Sign in at `/login` if not already signed in.
3. Go to `/map`.
4. **Catalog search (preferred):** In sidebar or URL, filter by a random term: `pizza`, `dedham`, `family`, `breakfast`. Pan/zoom the map slightly.
5. **Typeahead (1× per week max):** Click search box ("Search by name or place…"), type a query (e.g. `Dedham`), select a suggestion if shown.
6. Click one restaurant pin or list item → open detail page.
7. **Pass:** restaurant detail loads. **Fail:** sign-in required banner, blank map, or API error toast.

## Scenario: `submit_ttf`

**Goal:** Submit one TTF observation for a random restaurant.

1. Pick user (`pick-user`) and sign in.
2. Random field values:
   ```bash
   python3 scripts/synthetic-users/registry.py random-ttf
   ```
3. From `/map`, open a restaurant that shows in the catalog (prefer one without your prior submission if visible).
4. Navigate to submit: click **Rate speed** / submit link, or go to `/restaurants/{id}/submit`.
5. On submit form:
   - Use **Or enter elapsed minutes** (do not start timer unless you want to)
   - Set minutes, item type chip, quality stars, portion, daypart, kids count
   - Optional short context: "Synthetic agent visit."
6. Click **Submit observation** — expect toast "Observation saved" and redirect to restaurant detail.
7. Record observation id:
   - Go to `/account/contributions`
   - Find the newest Speed entry; copy UUID from Edit link (`/account/contributions/ttf/{id}/edit`)
   ```bash
   python3 scripts/synthetic-users/registry.py record-observation \
     --email 'EMAIL' --observation-id 'UUID'
   ```
8. **Pass:** contribution appears in account list.

## Scenario: `update_ttf`

**Goal:** Edit an existing TTF observation.

1. Pick user with prior observations:
   ```bash
   python3 scripts/synthetic-users/registry.py pick-user --with-observations
   ```
   If none, run `submit_ttf` first (same run counts toward max 3).
2. Sign in as that user.
3. Go to `/account/contributions` → filter **Speed** if needed.
4. Click **Edit** on a Speed row (or open `/account/contributions/ttf/{observation_id}/edit` from registry).
5. Change **elapsed minutes** (+/− 2–5 from current) and **quality** (±1 within 1–5).
6. Click **Save changes** — expect success toast and return to contributions.
7. **Pass:** updated values visible on contributions list.

## Scenario: `all`

Run in order up to max 3: `signup` (only if registry has fewer than 2 users), `search`, `submit_ttf`. Skip `update_ttf` unless requested explicitly.

## Slack report format

Post to `#little-scout`:

```
Scout synthetic run — {scenario}(s): {PASS|FAIL}
User: {email or "new signup"}
Actions: {brief list}
Notes: {errors or "ok"}
```

Attach screenshot on FAIL.

## Random data reference

Valid enums (must match API):

- `item_type`: fries, apple_slices, bread, kids_meal, other
- `portion_size`: kid, regular, shareable
- `daypart`: breakfast, lunch, dinner, late
- `elapsed_minutes`: 5–25
- `item_quality`: 3–5
- `party_size_kids`: 1–3

## Troubleshooting

| Symptom | Action |
|---------|--------|
| App Check / 401 on submit | Ensure real browser on app.dev (not API-only); wait for page fully loaded |
| reCAPTCHA loop | Retry once; screenshot and FAIL if persistent |
| No restaurants on map | Catalog may be empty — note in Slack; search scenario still passes if map loads |
| Registry file missing | Run `./scripts/sync-secrets.sh`; seed empty registry in Secret Manager |
| Rate limited (429) | Stop run; report in Slack |

## Related docs

- [docs/SYNTHETIC_USERS.md](../../docs/SYNTHETIC_USERS.md) — automation setup runbook
- [docs/CLOUD_AGENT.md](../../docs/CLOUD_AGENT.md) — VM bootstrap and secrets
