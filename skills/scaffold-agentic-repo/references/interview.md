# The interview and the config file

## Shape of the interview

One message, in this order:

1. **What I found**: three to six lines. Stack, size, agents already in use,
   default branch, CI, existing practice worth keeping.
2. **Recommended preset** and why, in one sentence.
3. **The settings**: one line per setting the user might want to change, each
   with the recommended value and a few words on what it means. Group them by
   module. Skip modules the preset leaves off unless detection suggests them,
   but list them in one line at the end ("Also available: …").
4. **Third-party tools**: for each one offered, the disclosure from its
   module reference, re-checked against the tool's README if the network is
   available (say so if it wasn't).
5. **The file plan**: files to be created and files to be modified, and
   anything that conflicts with existing practice and how you'll handle it.
6. **One closing question**: "Change anything, or go ahead?"

If an answer is genuinely undecidable by detection and has no safe default
(for example, whether sessions will run in the cloud), ask it as a direct
question inside step 3, not as a separate round.

Ask in plain words, using whatever way of asking questions this agent has. If
the agent can show options to pick from, use it for the preset and the ship
gate; free text for the rest.

## Presets

| Preset | For | Modules on |
|---|---|---|
| **Light** | A script, a small tool, an experiment, one person | Context (no decision records), Backlog (Markdown), Guardrails (format-on-edit only), Workflow folded into the context file. In Light, nothing may refer to a module that is off: no decision-record rule, no friction review, no `.agents/skills/` unless one exists |
| **Standard** | A real project with one deployable and one to a few people | Light + decision records, Plans, Verify, Ship gate (review loop), Workflow doc |
| **Full** | A multi-package product or a team running agents in parallel | Standard + per-package context files and the opt-in modules the user wants (Expertise, Parallel sessions). The CI check follows the same rule in every preset: on when the gate is installed and the repo is on GitHub |
| **Custom** | Anyone | Pick module by module |

Cloud sessions are asked about in every preset, because only the user knows
where their sessions run.

## Settings to ask about

Recommend a value for every one. Ask only those where the recommendation could
plausibly be wrong for this user.

| Setting | Options | How to recommend |
|---|---|---|
| Agents to support | `claude-code`, `codex`, `gemini-cli`, `copilot`, `cursor`, other | Those detected in the repo plus the one running this skill |
| Preset | Light / Standard / Full / Custom | From size and contributors |
| Decision records | on / off, directory | On unless Light; reuse an existing ADR directory |
| Backlog | `markdown`, `seeds`, `github-issues`, an existing tracker | Existing tracker if any; else `markdown`. Offer `seeds` with its disclosure; never recommend it only because `sd` is installed |
| Expertise store | `mulch` / off | Off. Offer `mulch` with its disclosure when the repo is old enough to have lessons |
| Format on edit | on / off | On if the repo configures a formatter (installed or not; the hook is best-effort) |
| Pre-commit checks | on / off | On if Standard or above and the repo has a formatter or linter to run; off otherwise (don't introduce one) |
| Hook manager | `none` (`.githooks/`), `husky`, `lefthook`, `pre-commit` | The one already in use; else `none` |
| Ship gate, local | `review-loop`, `no-mistakes`, none | `review-loop`. Offer `no-mistakes` with its disclosure for local work |
| Ship gate, cloud | `review-loop`, none | `review-loop` if cloud sessions are in scope |
| Reviewers | per agent: that agent's own read-only subagent, or a command (another agent or model) | Each agent's own subagent; a different model for cross-checking is worth offering if a second agent CLI is installed |
| Review rounds | 1–5 | 3 |
| CI check for the gate | on / off | On whenever the gate is installed and the repo is on GitHub (hooks are opt-in per clone; CI isn't). Install it when asked even if the repo has no CI yet |
| Agent branch prefixes | e.g. `claude/`, `codex/` | Existing convention, else one per supported agent |
| Cloud platforms | `claude-code-web`, others | Ask |
| Parallel sessions | `treehouse`, `git-worktree`, off | Off unless the user runs several local agents at once; then `git-worktree`, with `treehouse` offered with its disclosure |
| Weekly friction review | on / off | On for Standard and Full |
| Close out | commit on a branch / leave uncommitted; push and open a PR or not | Commit on a branch; don't push |

## `.agentic/config.json`

Written first in step 4, committed with the scaffold. It records what was
chosen so that a later run can upgrade, add a module or repair without asking
again, and the ship-gate scripts read their settings from it.

User defaults at `~/.config/agentic-scaffold/defaults.json` use the same
schema and may hold any subset. Never copy personal details from user defaults
into the repo's config unless they are also right for everyone working in the
repo.

```json
{
  "schemaVersion": 1,
  "scaffoldVersion": "2.0.0-draft",
  "preset": "standard",
  "agents": ["claude-code"],
  "git": {
    "remote": "origin",
    "defaultBranch": "main",
    "agentBranchPrefixes": ["claude/"]
  },
  "modules": {
    "context": { "enabled": true, "primaryFile": "AGENTS.md", "decisionsDir": "docs/decisions", "perPackage": false },
    "backlog": { "enabled": true, "backend": "markdown" },
    "plans": { "enabled": true, "dir": "docs/plans" },
    "expertise": { "enabled": false, "backend": "mulch" },
    "guardrails": { "enabled": true, "formatOnEdit": true, "preCommit": true, "hookManager": "none" },
    "verify": { "enabled": true },
    "shipGate": { "enabled": true, "local": "review-loop", "cloud": "review-loop", "ciCheck": true },
    "cloud": { "enabled": false, "platforms": [] },
    "parallel": { "enabled": false, "backend": "git-worktree" },
    "workflow": { "enabled": true, "doc": "docs/agentic-workflow.md", "frictionReview": true }
  },
  "gate": {
    "dataPaths": ["docs/"],
    "skipRemotes": ["no-mistakes"],
    "cloudEnvVars": ["CLAUDE_CODE_REMOTE"],
    "agentEnvVars": ["CLAUDECODE", "AI_AGENT"]
  },
  "review": {
    "maxRounds": 3,
    "reviewers": {
      "default": { "kind": "subagent" }
    }
  },
  "closeOut": { "branch": "chore/agentic-scaffold", "commit": true, "push": false }
}
```

Field notes:

- `modules.<name>.enabled`: whether the module was considered and installed.
  A module can be enabled with every sub-setting off (guardrails in a repo
  with no formatter: nothing to run yet, but the hook manager is recorded).
- `modules.context.decisionsDir`: `null` when decision records are off (Light).
- `modules.workflow.doc`: the workflow doc's path, or `null` when it is folded
  into the context file (Light).
- `modules.guardrails.hookManager`: `none` means plain `.githooks/` with
  `core.hooksPath`. The ship gate's self-test uses this to know how a fresh
  clone turns hooks on.
- `modules.shipGate.local` / `.cloud`: `"review-loop"`, `"no-mistakes"` or
  `"none"` (write `"none"`, not `null`, when that environment has no gate).
- `modules.cloud.environment` (user defaults only): the name of the user's
  general cloud environment, so the cloud module can point at it instead of
  asking. Never copy it into the repo's config.
- `modules.parallel.backend`: `git-worktree` or `treehouse`.
- `gate.dataPaths`: path prefixes that are not code and never owe a review
  (docs, the backlog file, the expertise store's directory). Add what
  `sd init` or `ml init` create if those modules are on.
- `gate.skipRemotes`: remotes the push gate ignores, because pushing there is
  itself a gate (no-mistakes' remote).
- `gate.cloudEnvVars` / `gate.agentEnvVars`: environment variables that mark a
  cloud session, or any agent session. A variable counts when it is set,
  non-empty and not `false` or `0`. In a cloud session every branch is gated.
  From an agent session every push is gated, and a push to a branch without
  an agent prefix is refused with "rename it". A person's own terminal has
  none of these set, so their pushes are untouched. Add the markers of each
  supported agent as you confirm them (see `references/agent-adapters.md`).
- `review.reviewers`: one entry per agent id (`claude-code`, `codex`, …) plus
  `default`. `{ "kind": "subagent" }` is that agent's own read-only subagent;
  `{ "kind": "command", "command": "…" }` runs a headless agent CLI, optionally
  another vendor's for a cross-model check; `"model"` on either picks a model
  where the agent allows it. See `references/agent-adapters.md`.
