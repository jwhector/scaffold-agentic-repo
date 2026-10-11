# Agent adapters

The scaffold writes one canonical copy of everything and gives each agent the
smallest pointer it needs. This file says where each agent looks.

Claude Code details are verified. Rows for other agents were checked against
public docs and community sources in October 2026, and agents change quickly:
**before writing an agent's files, confirm the location against that agent's
current docs or by inspecting a repo where it already works.** If you can't
confirm, write the canonical files only and list the agent's pointer as a
follow-up in the report.

## Canonical locations

| What | Canonical home |
|---|---|
| Context | `AGENTS.md` (root; one per package in a Full multi-package setup) |
| Repo skills the scaffold installs (`review-loop`, `verify`) | `.agents/skills/<name>/SKILL.md` |
| Scaffold config and ship-gate scripts | `.agentic/` |
| Git hooks | `.githooks/`, or the repo's existing hook manager |

`.agents/skills/` is the shared repo-level skills directory used by Codex and
the `skills` installer, and searched by GitHub's skill tooling. Agents that
don't read it get a pointer skill (below).

## Per-agent pointers

| Agent | Context pointer | Skills | Format-on-edit hook | Session markers (agent / cloud) |
|---|---|---|---|---|
| Claude Code | `CLAUDE.md` containing `@AGENTS.md` (Claude Code imports the file); one per package in a multi-package repo | Pointer skills in `.claude/skills/<name>/SKILL.md` | `PostToolUse` hook in `.claude/settings.json` | `CLAUDECODE=1`, `AI_AGENT=claude-code_…` (verified) / `CLAUDE_CODE_REMOTE=true` |
| Codex | None needed; reads `AGENTS.md` | Reads `.agents/skills/` | None known; nothing to install | Confirm by running `env` in its shell |
| Gemini CLI | Set `contextFileName` to `AGENTS.md` in `.gemini/settings.json`, or a `GEMINI.md` that says to read `AGENTS.md` | Confirm whether it reads `.agents/skills/`; else pointers in `.gemini/skills/` | Confirm current support | Confirm |
| GitHub Copilot | Reads `AGENTS.md` for its coding agent; keep any existing `.github/copilot-instructions.md` and make it point to `AGENTS.md` | Confirm; else pointers in `.github/skills/` | Not applicable | Copilot's coding agent runs in GitHub Actions (`GITHUB_ACTIONS=true`) |
| Cursor | Reads `AGENTS.md`; keep existing `.cursor/rules` and point them at `AGENTS.md` | Confirm | Confirm | Confirm |

**Session markers** feed `gate.agentEnvVars` and `gate.cloudEnvVars`. They are
set in the shell an agent session opens, not in a person's own terminal, so
gating on them never touches a person's push. To confirm an agent's marker:
run `env` from inside that agent and look for a variable that names it.
Unconfirmed agents fall back to branch-prefix gating; say so in the report.

**If a repo already has an agent-specific context file with real content**
(a long `CLAUDE.md`, say), move its durable content into `AGENTS.md` and leave
the pointer behind, in the same change. Don't leave two files with overlapping
rules.

### Pointer skill

Same frontmatter as the canonical skill; the body only points:

```markdown
---
name: review-loop
description: <copied exactly from the canonical skill>
---

Follow `.agents/skills/review-loop/SKILL.md`. It is the single copy of this
skill for every agent in this repo; don't edit this file, edit that one.
```

The description is duplicated because agents trigger on it. That is the one
permitted duplicate. Note it in the canonical skill's header so a later edit
updates both.

### Claude Code hooks

Format on edit, best-effort (never blocks an edit):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "timeout": 60, "command": "<format and lint-fix the edited file> >/dev/null 2>&1 || true" }]
      }
    ]
  }
}
```

The hook receives the tool input as JSON on stdin; extract
`.tool_input.file_path`. Use whatever JSON reader the stack already has
(`node -e`, `python -c`, `jq` if present). Exit 0 on any failure, including
tooling that isn't installed yet.

Session-start hooks for cloud sessions are in `modules/cloud.md`.

## Starting a reviewer

The ship gate's review loop needs a fresh, read-only reviewer each round.
`review.reviewers` in `.agentic/config.json` maps each agent id to one, plus a
`default`:

```json
"reviewers": {
  "claude-code": { "kind": "subagent" },
  "codex": { "kind": "command", "command": "codex exec --sandbox read-only" },
  "default": { "kind": "subagent" }
}
```

The loop uses the entry for the agent running it (an agent knows which it is;
the session markers above confirm it), else `default`. If that entry fails
(CLI not installed, no credentials), it tries the agent's own subagent if it
has one, then any other configured command, and otherwise stops and tells the
person. It never skips the review. Pointing an agent at another vendor's
reviewer for a cross-model check is a deliberate choice in the interview, not
a fallback.

**`{ "kind": "subagent" }`**: the agent's own subagent mechanism, if it has one
that can be restricted to read-only tools and started with a clean context.

- Claude Code: `.claude/agents/reviewer.md` from `templates/review-kit/reviewer.md`
  (tools `Read, Grep, Glob`). Spawn it with the Agent tool. `"model"` in the
  entry goes into the file's frontmatter.
- Other agents: use their equivalent only if read-only can be enforced, not just
  requested. Otherwise use a command.

**`{ "kind": "command", "command": "<template>" }`**: a headless agent CLI.
The loop runs the command with the working directory set to the review
directory's `head/`, passes the reviewer message as the final argument, and
saves standard output as the review. The command **must enforce read-only**.
Examples to adapt (confirm flags against the installed version's `--help`):

- Claude Code: `claude -p --allowedTools "Read,Grep,Glob"`
- Codex: `codex exec --sandbox read-only`
- Gemini CLI: `gemini -p` with its read-only/sandbox option for the installed
  version

A headless reviewer needs its own credentials. In a cloud session those must
come from the platform's environment (see `modules/cloud.md`); if they aren't
there, the fallback order above applies.
