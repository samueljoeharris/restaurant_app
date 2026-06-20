---
name: github-issue-orchestrator
description: >-
  Autonomous GitHub issue delivery: plan, delegate sub-agents, implement, validate
  via CI/CD and live checks, up to 3 attempts. Use when the user assigns work on a
  GitHub issue (e.g. "work on issue #42", "implement #42", "fix issue 42").
---

# GitHub Issue Orchestrator

Deliver a GitHub issue end-to-end as **orchestrator**. Do not ask the user questions until **success** or **3 failed attempts**. Then update the issue, report once in chat, and stop.

## Activation

User assigns an issue by number, URL, or title. Parse repo as `samueljoeharris/restaurant_app` unless they specify another.

## Hard constraints

| Rule | Detail |
|------|--------|
| **Max attempts** | 3 loops (`attempt` = plan → implement → validate). Stop after attempt 3 fails. |
| **No mid-flight questions** | No `AskQuestion`, no "should I…?", no blocking on user input. Decide with defaults (below). |
| **Issue is the log** | Post progress to the issue each attempt; final comment on success or exhaustion. |
| **Orchestrator role** | You plan and synthesize; delegate research and isolated coding to sub-agents. |
| **Deliver = live** | Local CI green **and** (when deployable) push → pipeline green → live smoke test passes. |

## Defaults (use without asking)

- **Repo workflow:** Solo dev — commit and push to `main` when delivery requires deploy ([docs/CI.md](docs/CI.md)).
- **Branch:** Push to `main` unless the issue explicitly requires a feature branch or PR.
- **Scope:** Issue title + body + linked docs only; no drive-by refactors.
- **Backlog:** Read [docs/ROADMAP.md](docs/ROADMAP.md); assigned issue overrides `now` queue hesitation — proceed.
- **Commits:** Implied by this workflow (user assigned delivery).
- **Missing secrets / env:** Count as attempt failure; document blocker in issue comment; do not ask user to paste secrets.
- **Ambiguous acceptance criteria:** Infer minimal shippable interpretation from issue + codebase; note assumption in issue comment.

## Attempt loop

Track `attempt` (1–3). At **start** of each attempt, comment on the issue (see [reference.md](reference.md)).

```
┌─────────────────────────────────────────────────────────┐
│ ATTEMPT N (N ≤ 3)                                       │
├─────────────────────────────────────────────────────────┤
│ 1. LOAD    gh issue view; read ROADMAP if needed        │
│ 2. PLAN    Short plan in thinking; optional explore    │
│            sub-agent for >3-file research               │
│ 3. IMPLEMENT Orchestrator edits OR delegate:            │
│            - explore / generalPurpose: research         │
│            - generalPurpose + worktree: isolated writes   │
│            - shell: git, ci-check, gh, docker           │
│            - bugbot: post-implementation review (opt.)  │
│ 4. LOCAL CI ./scripts/ci-check.sh or --all              │
│ 5. SHIP    git commit + push origin main (if deploy)    │
│ 6. PIPELINE gh run list/watch; CI/CD / CI must pass     │
│ 7. VALIDATE Live smoke (API curl / browser) per issue   │
│ 8. GATE    Pass → SUCCESS | Fail → next attempt or STOP │
└─────────────────────────────────────────────────────────┘
```

### Sub-agent rules

- Brief sub-agents fully (paths, prior failures, acceptance criteria).
- Mark **research only** vs **write code**.
- Use `isolation: "worktree"` (or `best-of-n-runner`) when sub-agents edit files in parallel or retry isolated implementations.
- Synthesize sub-agent output; never paste raw dumps to the user.

### Implementation

- Match existing conventions; minimal diff ([AGENTS.md](AGENTS.md)).
- Cross-stack changes (`api/` + `web/`) need both in one push when required.
- Follow [.cursor/rules/ci-before-push.mdc](.cursor/rules/ci-before-push.mdc) before push.

### CI/CD gate

1. **Local:** `./scripts/ci-check.sh` (path-aware) or `--all` if unsure.
2. **Push:** `git push origin main` (never `--no-verify` unless user explicitly allowed).
3. **Watch:** `gh run list --workflow=deploy.yml --limit 3` then `gh run watch <id>`.
4. **Required check:** **CI/CD / CI** green. If deploy jobs skipped (path filter), dispatch reusable workflow or include paths — see [docs/CI.md](docs/CI.md).
5. **Do not claim done** until pipeline confirms deploy for touched surfaces.

### Live validation

Pick checks that prove the issue acceptance criteria:

| Surface | Base URL | Typical checks |
|---------|----------|----------------|
| API | `https://api.dev.littlescout.app` | `curl` health + issue-specific endpoint |
| Web | `https://app.dev.littlescout.app` | Browser MCP: `source scripts/load-dev-test-env.sh`, sign in at `/login`, run [TEST_FLOWS.md](docs/TEST_FLOWS.md) P0 |
| Admin | `https://admin.dev.littlescout.app` | API-only unless issue is admin UI (IAP) |
| Local fallback | `localhost:8080` / `:5173` | When push/deploy not required (docs-only, local-only) |

Use **browser MCP** for UI flows; use **curl / gh api** for API contracts.

## Success gate (only then talk to user)

1. Comment on issue: summary, commits, deploy run URL, validation performed.
2. Close issue (`gh issue close`) or add `done` label if team uses labels.
3. **One chat message:** what shipped, link to issue, CI run, how validated.

## Failure gate (after attempt 3)

1. Comment on issue: structured report (see [reference.md](reference.md)) — what was tried, errors, blockers, suggested next steps.
2. Leave issue **open**.
3. **One chat message:** failed after 3 attempts, link to issue comment, top blocker.

## Attempt failure (before 3)

- Comment what failed and what changes in the next attempt.
- Incorporate failure into the next plan; do not ask the user.

## Quick start

User: *"Work on issue #42"*

1. `gh issue view 42 --repo samueljoeharris/restaurant_app`
2. Comment: `🤖 Attempt 1/3 — starting`
3. Run attempt loop
4. Success or attempt 3 → issue update + single user message

Templates and `gh` commands: [reference.md](reference.md)
