# Module: Guardrails

Guardrails nudge; they never block. Gates (the ship gate) gate.

## Format on edit

For each supported agent that has edit hooks (`references/agent-adapters.md`), a hook
that formats and lint-fixes the file just edited. **Best-effort by design**:
exit 0 on any failure, including tools not installed yet. A hook that can block
an edit will eventually block a legitimate one.

Use the formatter and linter the repo already configures, even if they aren't
installed on this machine; the hook does nothing until they are. If the repo
has none, don't introduce one here; mention it in the report as a possible
next step. In Node repos call tools with `npx --no-install`, so the hook never
downloads anything.

## Pre-commit (Standard and Full)

Fast checks on staged files only: format check and lint. Anything slow
(typecheck, the full test suite, a build) belongs in CI, not in the commit
path, or agents and people learn to skip it.

If the repo has no formatter or linter, there is nothing for this hook to run:
set `preCommit: false` and move on. If an existing hook checks the whole tree
rather than staged files, keep it (existing practice wins) and note it.

## Hook managers

The repo's git hooks (pre-commit here, pre-push from the ship gate) go through
whatever manager the repo already uses. `modules.guardrails.hookManager`
records it. Each manager has its own way to turn hooks on in a fresh clone,
and that step is what makes the hooks real: until it runs, the hooks are files
nobody executes.

| Manager | Hook files | Turned on by | "Already on" test (for the session-start hook) | Notes |
|---|---|---|---|---|
| `none` | `.githooks/<hook>` | `git config core.hooksPath .githooks` | `git config core.hooksPath` succeeds | Add `"prepare": "git config core.hooksPath .githooks"` in Node repos so the package manager's install does it (npm, pnpm and yarn all run `prepare`); otherwise a line in `AGENTS.md` under first-time setup |
| `husky` (v9) | `.husky/<hook>` | the package manager's install runs the `prepare` script, which runs `husky` | `git config core.hooksPath` succeeds | Add `"prepare": "husky"` if missing (it was missing in one of the evals). **Never set `core.hooksPath` yourself**; husky points it at `.husky/_`, which only exists after install. Hook files need no shebang but must be LF |
| `lefthook` | `lefthook.yml` | `lefthook install` (its npm/pip packages run it on install) | `[ -f "$(git rev-parse --git-path hooks)/pre-push" ]` | Add a `pre-push` command that runs `sh .agentic/scripts/pre-push.sh` with the hook's stdin and arguments; confirm the option names against the installed version's docs |
| `pre-commit` | `.pre-commit-config.yaml` | `pre-commit install` | `[ -f "$(git rev-parse --git-path hooks)/pre-push" ]` | Add `default_install_hook_types: [pre-commit, pre-push]` at the top of the config so the one `install` command the README already tells people to run turns both stages on. Add a `local` repo hook at `stages: [pre-push]` with `entry: node .agentic/scripts/loop-gate.mjs --pre-commit`, `language: system`, `pass_filenames: false`, `always_run: true`; the framework passes the refs in environment variables, which that mode reads. `pre-push.sh` is not needed with this manager |

Whatever the manager:

- Commit hook files as executable: `git add --chmod=+x <file>`. A hook
  committed from Windows without the bit is silently skipped elsewhere.
- Force LF line endings for hook files and `*.sh` in `.gitattributes`
  (`*.sh text eol=lf`, plus the hook directory). A CRLF checkout breaks `sh`.
- Say in `AGENTS.md`, under first-time setup, the one command that turns hooks
  on, and that CI's gate check is the backstop for a clone that skipped it.
- For Claude Code, the ship gate adds a SessionStart hook that turns hooks on
  in every session using the manager's own command (see `ship-gate.md`).
