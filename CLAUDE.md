@AGENTS.md

# Claude Code — Little Scout

Shared repo guidance is imported from [AGENTS.md](AGENTS.md) above. Do not duplicate it here.

## Claude Code bootstrap

Remote sessions (Claude Code on the web) run [.claude/hooks/session-start.sh](.claude/hooks/session-start.sh) via [.claude/settings.json](.claude/settings.json): installs web + API dependencies and scaffolds the no-secret Firebase emulator env files. iOS builds and Docker CI image builds are skipped on Linux.

For real Firebase dev (same as `app.dev`), use GSM via `./scripts/sync-secrets.sh` on a Mac, or follow [docs/CLOUD_AGENT.md](docs/CLOUD_AGENT.md) for Cursor Cloud Agents.

## Cursor-only surfaces

These do not load in Claude Code; equivalent workflow rules live in AGENTS.md:

| Surface | Path |
|---------|------|
| Always-on rules | [.cursor/rules/](.cursor/rules/) |
| Skills (issue orchestrator, design, synthetic user) | [.cursor/skills/](.cursor/skills/) |
| MCP servers | [.cursor/mcp.json](.cursor/mcp.json) — see [docs/MCP_SETUP.md](docs/MCP_SETUP.md) |

When assigned a GitHub issue in Cursor, follow [.cursor/skills/github-issue-orchestrator/SKILL.md](.cursor/skills/github-issue-orchestrator/SKILL.md). In Claude Code, use the **GitHub issue delivery** section in AGENTS.md instead.
