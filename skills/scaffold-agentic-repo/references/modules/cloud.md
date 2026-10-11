# Module: Cloud sessions

For repos where agents also run as cloud sessions: on a fresh VM, started
from a web or mobile app, or on a schedule. Each platform is an adapter;
**Claude Code on the web** is the one written out here. For another platform,
apply the same four ideas (shared toolchain, dependencies from the repo, hooks
turned on, cloud rules in `AGENTS.md`) using its own docs, and say in the
report which parts you could not confirm.

## The four ideas

1. **The toolchain lives in the platform's environment; dependencies install
   from the repo.** The environment is shared across repos and changes rarely.
   The repo's own dependencies change with the repo, so the repo installs them.
2. **Hooks are off until something turns them on.** A fresh clone has no
   `core.hooksPath`, so the ship gate does nothing unless a session-start step
   sets it.
3. **Credentials are a capability, not a default.** Anyone who can use an
   environment can read its variables. A credential in a shared environment
   reaches every session in every repo that uses it.
4. **The cloud rules are written down** in `AGENTS.md`, because a cloud session
   has nobody to ask.

## Claude Code on the web

Sessions run in an **environment**: a setup script, a network policy and
variables, configured per account in the Claude app, not in the repo. An
environment isn't tied to a repo, and its setup script can't count on the repo
being cloned yet.

**Environment** (the user does this; report it as a step for them):

- Prefer **one general environment** for the toolchain the user's repos need
  (language runtimes, package managers, optional tools like `sd` or `ml`), with
  **no variables**. If the user's defaults name one, use it and say which
  tools this repo needs it to have.
- A **separate environment only for a capability**: a credential, a custom
  network allowlist, heavy binaries. Name it for the job (`deploy-docs`), not
  the repo.
- Don't copy an environment's setup script into the repo. It has one home,
  wherever the user keeps it.

**Repo** (you do this), a SessionStart hook in `.claude/settings.json`, placed
before the ship gate's hooks-on entry so that installed dependencies are there
when it runs:

```json
{
  "type": "command",
  "timeout": 300,
  "statusMessage": "Installing dependencies (cloud)",
  "command": "[ \"$CLAUDE_CODE_REMOTE\" = \"true\" ] && cd \"$CLAUDE_PROJECT_DIR\" && <install command> >/dev/null 2>&1 || true"
}
```

- `<install command>` is the stack's frozen install (`npm ci`,
  `pnpm install --frozen-lockfile`, `uv sync`, `bundle install`, …). A frozen
  install needs a lockfile; if the repo has none, that is a pre-existing gap
  to report, and the hook uses the unfrozen install until it's fixed. If the
  install is too slow for a hook, drop the hook and say in `AGENTS.md` to run
  it before the first check.
- With husky, the install also turns the hooks on. With other managers, the
  ship gate's hooks-on SessionStart entry does it.
- `CLAUDE_CODE_REMOTE` is already in `gate.cloudEnvVars` by default.

**A headless reviewer** (a `review.reviewers` entry with `"kind": "command"`)
needs its CLI and credentials in the environment. If that means putting a
credential in the general environment, don't; use the subagent reviewer in the
cloud instead.

## `AGENTS.md`: "In a cloud session"

A short section:

- Push only to a branch starting with one of `git.agentBranchPrefixes`.
- Run the verify steps before pushing.
- Write commit messages for the reviewer: what was asked, the acceptance
  criteria, what was decided, what was left out.
- Commit as you go and push once, when the work is complete. The push opens the
  PR, and every push of new code owes a review loop.
- Run `review-loop` once, right before that push. Nothing that changes code may
  follow its summary. The push gate refuses the push otherwise; never
  `--no-verify` it.

If any automated or scheduled agent prompt can push to this repo, it must
say the same, and every rule about which branches agents may push to must
agree with `git.agentBranchPrefixes`.
