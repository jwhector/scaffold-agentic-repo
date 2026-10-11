# Module: Ship gate

The property to establish: **a person is not the first reviewer, and the PR is
already fixed by the time they look.** Never push agent work straight to the
default branch.

Two mechanisms, chosen per environment in the interview:

| | Review loop (this kit) | no-mistakes |
|---|---|---|
| Where it runs | Inside the agent session: local or cloud | A local daemon behind a git remote; cloud use unverified |
| Agents | Any; reviewer is a subagent or any headless agent CLI | Many agent CLIs (Claude, Codex, Copilot, OpenCode, …) |
| What it does | Fresh read-only reviewer per round; the session fixes; up to N rounds; summary commit; pre-push gate; CI check | Fixed pipeline: intent, rebase, review, test, document, lint, push, PR, CI watch and fix |
| Cost | 1–N reviewer calls | Many agent calls per run |
| Setup | Copy files; needs `node` | Binary, daemon, `init`, agent and forge credentials |

**Default: review loop**, because it works everywhere. Offer no-mistakes, with
its disclosure, for local work when the user wants the full pipeline. Valid
combinations: review loop everywhere; no-mistakes locally and the review loop
in the cloud; either alone; none. **Never both on the same push.** The kit's
push gate skips remotes in `gate.skipRemotes` (default `no-mistakes`) for that
reason.

## Option A: the review loop

### Files

Copy from `templates/review-kit/`:

| Template | Installs as |
|---|---|
| `review-loop.SKILL.md` | `.agents/skills/review-loop/SKILL.md` (+ pointers per `references/agent-adapters.md`) |
| `reviewer.md` | `.claude/agents/reviewer.md`, for Claude Code with a `subagent` reviewer; add `model: <id>` to its frontmatter if the reviewer entry sets one |
| `review-prompt.md` | `.agentic/review-prompt.md` |
| `config.mjs`, `loop-gate.mjs` + `.test.mjs`, `review-materials.mjs` + `.test.mjs`, `gate-selftest.mjs` | `.agentic/scripts/` |
| `pre-push.sh` | `.agentic/scripts/pre-push.sh`, executable, `{{AGENT_BRANCH_PREFIXES}}` replaced with the prefixes separated by spaces. Not needed with the `pre-commit` manager, which calls `loop-gate.mjs` directly |
| `pre-push` | the hook manager's pre-push entry (below), executable |
| `review-loop-check.yml` | `.github/workflows/review-loop-check.yml` when `shipGate.ciCheck` is on |
| `gate-tests.yml` | the gate's unit tests in CI: add its one step to the repo's existing CI workflow if there is one, else install this file as `.github/workflows/gate-tests.yml` (GitHub repos) |

Then run the repo's formatter over what you installed, so the files pass the
repo's own pre-commit check. Note in the report that they now differ from the
templates by formatting only.

### Wiring the hook

`pre-push.sh` is the gate; the hook manager's entry only calls it
(`modules.guardrails.hookManager`, see `guardrails.md`):

| Manager | Entry |
|---|---|
| `none` | `.githooks/pre-push` = the `pre-push` template |
| `husky` | `.husky/pre-push` = the `pre-push` template; make sure `package.json` has `"prepare": "husky"` |
| `lefthook` | a `pre-push` command in `lefthook.yml` running `sh .agentic/scripts/pre-push.sh` with the hook's arguments and stdin |
| `pre-commit` | a `local` hook at `stages: [pre-push]` running `node .agentic/scripts/loop-gate.mjs --pre-commit` |

Commit entries and `pre-push.sh` executable (`git add --chmod=+x`) and LF
(`.gitattributes`).

**Hooks on, everywhere.** Hooks are files until something activates them in
each clone:

- Node repos: the `prepare` script (husky's, or
  `git config core.hooksPath .githooks` for `none`) runs on `npm install`.
- Claude Code: a SessionStart hook in `.claude/settings.json` that runs the
  manager's activation if hooks aren't on yet, best-effort:
  `cd "$CLAUDE_PROJECT_DIR" && { <already-on test> || <activation>; } >/dev/null 2>&1 || true`,
  with the test and activation from the hook-manager table in
  `guardrails.md` (`git config core.hooksPath` for `none` and husky; a check
  for the generated `pre-push` file for lefthook and pre-commit). Claude Code
  runs hook commands with `sh`, on Windows too. In the cloud module's layout
  this comes after the dependency install.
- Everyone else: one line under first-time setup in `AGENTS.md`.
- **The CI check is the backstop** and is on by default when the repo is on
  GitHub: hooks are opt-in per clone; CI is not.

### What the gate gates

Pushes from an agent session (`gate.agentEnvVars`), pushes in a cloud session
(`gate.cloudEnvVars`), and pushes to agent-prefixed branches
(`git.agentBranchPrefixes`). From an agent session, a push to a branch without
an agent prefix is refused with a rename instruction, so agent work always
reaches GitHub under a prefix the CI check recognises. A person pushing from
their own terminal to their own branch is untouched. Detection records which
markers this agent sets; add other agents' markers as you confirm them.

### Teach the rhythm

Add a short "Before you push" section to `AGENTS.md`: commit as you go; don't
push work in progress; when the work is complete and verified, run
`review-loop` once; nothing that changes code may follow its summary; then
push once. Data-only commits (backlog ticks, expertise records) may follow it.
A person bypasses the gate deliberately with `git push --no-verify`; an agent
never does.

### Audit every path that ends in a push

Or the gate turns them into dead ends:

- Any instruction (in `AGENTS.md`, a skill, a CI job, a scheduled-agent
  prompt) that ends in a commit touching code must come before the loop. Grep
  for them.
- An "abandon this work" path that discards code with `git restore` leaves
  committed code on the branch, so its note push is refused. Abandoning
  resets to the base branch before committing the note.
- Any automated prompt that can push code must say to run the loop first.
- Every rule that says which branches agents push to must agree with
  `git.agentBranchPrefixes`.
- When this replaces an earlier review mechanism, mark the old mechanism's
  docs and records as superseded in the same change.

### Adapt the prompt

Adapt only "What to check" in `review-prompt.md` to the repo's real rules,
citing `AGENTS.md` rule numbers. When the expertise-store module is off, drop
the expertise check and the "Worth recording" output section, and leave the
`expertise.md` line in the directory listing (the script still writes the
file, saying the store isn't in use). Keep the security paragraphs and the
rest of the output shape.

### Say what the gate is

An attestation, not proof. It stops a forgotten loop and code committed after
it. It does not stop a faked summary or a session that edits the local gate
script, and the final round's fixes are not re-reviewed when the round cap is
hit. The CI check (which runs the base branch's copy of the script) and the
person's review are the checks on those. Put this in the workflow doc.

### No second machine reviewer after the push

Don't add a CI reviewer that reads the PR again on top of the loop. It can't
fix anything, it repeats a review that just ended clean, and if it runs when
the PR opens it reads a head the loop is about to rewrite. The CI check is
different: it only confirms the loop's summary is last on the PR head, failing
closed, which also catches commits a person added later and `--no-verify`
pushes. A data-only or non-agent PR gets a green result, because a check that
is always red gets ignored.

### Tests

`node --test .agentic/scripts/*.test.mjs` (glob unquoted: a directory argument
fails on Node 21+, a quoted glob on Node 20). A plain `node --test` skips
dot-directories, so wire this command into CI explicitly (`gate-tests.yml`,
or one step in the existing workflow); in Node repos add it as a `test:gate`
script. Then, **after the scaffold is committed**,
`node .agentic/scripts/gate-selftest.mjs`: it clones the committed history,
turns hooks on the way a fresh clone would, and pushes through the real hook:
refused without a loop, accepted with one, refused to a branch without an
agent prefix. When the manager's tool isn't installed (offline, no
dependencies), it falls back to an emulated hook and says so; that proves the
gate and the entry, not the manager's own hook generation, so the report
says to run it again after the first real install.

### After the PR exists

An agent addressing a person's review comments batches them: fix them all,
loop once, push once, notify once.

## Option B: no-mistakes

[kunchenguid/no-mistakes](https://github.com/kunchenguid/no-mistakes). Disclose
in the interview, from its own docs (re-check the current README when you
can):

- It runs the agent CLIs it drives with their permission prompts bypassed; its
  docs describe staying inside the worktree as prompt steering, not a sandbox.
- Telemetry is on by default (`NO_MISTAKES_TELEMETRY=0` turns it off) and it
  checks for updates on every command.
- It installs a background daemon and a local gate remote.

Install: follow its README to install and run its `init` in the repo, then
commit its repo config (`.no-mistakes.yaml`) with the test, lint and format
commands from detection. Add to `AGENTS.md`: push through the gate remote
(`git push no-mistakes`), not `origin`. If the review loop is also installed
(for cloud sessions), keep `no-mistakes` in `gate.skipRemotes` so the two
don't block each other.

In a cloud session, no-mistakes is unverified: the agent CLI it drives needs its
own credentials, it needs an authenticated `gh` for the PR and CI steps, and it
must be reinstalled each session. Don't configure it for cloud unless the user
has tested it there.
