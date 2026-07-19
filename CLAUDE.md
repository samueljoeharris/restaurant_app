@AGENTS.md

# Claude Code — Little Scout (backup)

This repository uses **Devin** as its primary agent harness. Claude Code is a supported backup when Devin is unavailable. Shared repo guidance is imported from [AGENTS.md](AGENTS.md) above. Do not duplicate it here.

## Claude Code bootstrap

Remote Claude Code sessions run [.claude/hooks/session-start.sh](.claude/hooks/session-start.sh) via [.claude/settings.json](.claude/settings.json): installs web + API dependencies and scaffolds the no-secret Firebase emulator env files. iOS builds and Docker CI image builds are skipped on Linux.

For real Firebase dev (same as `app.dev`), use GSM via `./scripts/sync-secrets.sh` on a Mac, or use Devin's secret management in a Devin session.

## Notes for Claude Code backup sessions

- The `.cursor/` directory and rules have been removed; the project is now Devin-first.
- Equivalent workflow rules from the old `.cursor/rules/` directory now live in [AGENTS.md](AGENTS.md).
- For issue delivery and sub-agent delegation in Claude Code, follow the **GitHub issue delivery** section in [AGENTS.md](AGENTS.md).
