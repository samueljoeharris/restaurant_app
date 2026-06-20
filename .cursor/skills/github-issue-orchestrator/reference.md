# GitHub Issue Orchestrator — Reference

## Issue comments

### Attempt start

```markdown
🤖 **Attempt {N}/3** — starting

**Plan:** {1–3 bullet plan}

**Assumptions:** {only if inferring ambiguous AC}
```

### Attempt failed (retry)

```markdown
🤖 **Attempt {N}/3** — failed

**What was done:** {bullets}
**Failure:** {CI error, validation mismatch, blocker}
**Next attempt:** {what changes in N+1}
```

### Success

```markdown
🤖 **Delivered** ✅

**Summary:** {what shipped}
**Commits:** {SHAs or range}
**CI/CD:** {link to green run}
**Validation:** {curl / browser steps performed}
```

### Exhausted (3 failures)

```markdown
🤖 **Stopped after 3 attempts** ❌

**Goal:** {issue title}
**Tried:**
1. {attempt 1 summary + failure}
2. {attempt 2 summary + failure}
3. {attempt 3 summary + failure}

**Blocker:** {primary reason delivery failed}
**Suggested next steps:** {concrete actions for a human}
```

## gh commands

```bash
# Load issue
gh issue view <num> --repo samueljoeharris/restaurant_app

# Progress comment
gh issue comment <num> --repo samueljoeharris/restaurant_app --body "$(cat <<'EOF'
...
EOF
)"

# Close on success
gh issue close <num> --repo samueljoeharris/restaurant_app --comment "Delivered in ..."

# Watch latest deploy pipeline
gh run list --repo samueljoeharris/restaurant_app --workflow=deploy.yml --limit 1
gh run watch <run-id> --repo samueljoeharris/restaurant_app --exit-status

# Manual deploy if job skipped (pick workflow)
gh workflow run reusable-api.yml --repo samueljoeharris/restaurant_app --ref main
gh workflow run reusable-web.yml --repo samueljoeharris/restaurant_app --ref main
```

## Validation snippets

```bash
# API health
curl -sf https://api.dev.littlescout.app/health

# Browser UI — load shared test login (never echo password)
source scripts/load-dev-test-env.sh
# Sign in at https://app.dev.littlescout.app/login with $DEV_TEST_EMAIL / $DEV_TEST_PASSWORD
# Flows: docs/TEST_FLOWS.md (WEB-AUTH-01, WEB-MAP-01, …)

# Example authenticated dev token (local compose only)
curl -sf -H "Authorization: Bearer dev:pilot" \
  http://localhost:8080/v1/restaurants/map
```

## Sub-agent prompt skeleton

```
Full Repository Path: /Users/samuelharris/codebase/restaurant_app
Issue: #<num> — <title>
Acceptance criteria: <from issue body>
Attempt: <N>/3
Prior failures: <summary or "none">

Task: <research only | implement>
<specific instructions>

Return: files touched, test/validation results, blockers.
```

## Worktree isolation

For parallel or retry implementations, use Task with `subagent_type: best-of-n-runner` or `isolation: "worktree"` so failed attempts do not dirty the main tree. Merge winning changes back before commit.
