---
name: scaffold-agentic-repo
description: Set a repository up for AI coding agents, in a new repo or retrofitted onto an existing one. Interviews the user, then installs the modules they pick — self-describing context (AGENTS.md and decision records), a dependency-aware backlog, plan templates, guardrails, a verify skill, a ship gate (an in-session review loop and/or no-mistakes), cloud-session readiness, parallel worktrees and a maintenance routine. Works with Claude Code, Codex, Gemini CLI, Copilot and other agents. Use for "set this repo up for agents", "scaffold the agentic workflow", "make this repo self-describing", "add a review gate before agents push", or to upgrade or add modules to a repo scaffolded earlier.
metadata:
  version: 2.0.0-draft
---

# Scaffold the agentic workflow into a repo

This skill installs a working method for agent-driven development. The method in
one paragraph: **the repo describes itself, so starting a session is "read the
docs, here's the task"; planning and execution are separate rhythms; agents
build confidence before a person looks; every fact lives in exactly one place;
recurring friction gets converted into infrastructure on a schedule.** The
reasoning behind each piece is in `references/principles.md`. Read it when the
user asks why, or when a judgment call in a retrofit needs the intent.

Paths in this file are relative to the folder this file is in.

## How a run goes

1. **Load** what is already decided.
2. **Detect** everything that can be detected.
3. **Interview**, once, with recommendations filled in.
4. **Install** the chosen modules, in order.
5. **Verify** that nothing broke.
6. **Close out** and report.

Never write to the repo before step 4. Steps 1–3 only read.

## 1. Load

- **`.agentic/config.json` in the repo.** If it exists, this is a re-run: an
  upgrade, a module being added, or a repair. Read it, compare its
  `scaffoldVersion` with this skill's `metadata.version`, and treat its answers
  as decided. Ask only about what is new or what the user wants to change.
- **User defaults**, if present: `~/.config/agentic-scaffold/defaults.json`
  (same schema, any subset). These are a person's standing preferences
  (their usual tools, branch prefix, cloud setup). They pre-fill the interview;
  they never skip it.

The schema is in `references/interview.md`.

## 2. Detect

Inspect, don't ask. Record what you find; it becomes the interview's
recommendations.

- **Shape and size**: languages, packages/workspaces, deployables, contributors
  (`git shortlog -sn HEAD | head`), age. This suggests a preset.
- **Stack**: package manager, formatter, linter, type checker, test runner, CI
  provider, git-hook manager (husky, lefthook, pre-commit, `.githooks/`, none),
  whether a lockfile exists, and whether `.gitignore` covers the stack's
  dependency and build directories (a missing one is a pre-existing gap to
  report, not something the scaffold adds).
- **Which checks already fail.** Run the repo's checks once, before touching
  anything, and note which fail or can't run (no dependencies installed, no
  lockfile, a linter with no config). Those go in the report as pre-existing;
  the scaffold is not expected to fix them. Installing dependencies needs the
  network and can create a lockfile, so ask before doing it.
- **The session you're in**: which environment variables this agent sets in
  its shell (for Claude Code, `CLAUDECODE` and `AI_AGENT`). The gate uses them
  to recognise a push made from an agent session; see `references/agent-adapters.md`.
- **Agents already in use**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
  `.github/copilot-instructions.md`, `.cursor/`, `.claude/`, `.codex/`,
  `.agents/`. See `references/agent-adapters.md` for what each implies.
- **Git**: default branch (`git symbolic-ref refs/remotes/origin/HEAD`), remote
  host, existing branch-naming conventions for agent work. "On GitHub" means
  the remote is GitHub, or the repo already has `.github/workflows/` or refers
  to GitHub Issues; a local remote with GitHub workflows counts.
- **Tools on PATH**: `node`, `gh`, and the optional tools each module can use
  (`sd`, `ml`, `no-mistakes`, `treehouse`). Absence never blocks anything;
  every module has a fallback. **Presence is not a recommendation**: a tool
  being installed on this machine says nothing about this repo or its other
  contributors. Offer it in the interview with its disclosure; recommend the
  fallback.
- **Existing practice** (retrofit): docs systems, trackers, hooks, review
  rules, decision logs. **A field-tested existing practice wins over this
  scaffold.** Extend it; never install a parallel duplicate. Note each
  divergence for the report.

## 3. Interview

Follow `references/interview.md`. In short:

- **One round.** Present what you detected, a recommended preset (Light,
  Standard, Full) and the module list with recommended settings, all filled in.
  The user confirms or changes things. Ask separately only about what detection
  could not decide. If the request already answers everything ("Standard, the
  review loop, don't ask again"), skip the round: put the filled-in answers and
  the file plan at the top of the final report instead.
- **Ask in plain words**, using whatever way of asking questions this agent
  has. Keep it short enough to answer in one reply.
- **Disclose before offering a third-party tool**: what it installs, how,
  whether it sends telemetry, and how much it is trusted with (see each
  module's reference). Re-check the tool's README when you can; without
  network access, use the module's text and say it may be out of date.
  **"Take your recommendations" never covers a third-party tool** the user
  has not seen the disclosure for: use the fallback and list the tool as an
  option in the report.
- **Show the file plan with the questions**: what will be created, what will be
  modified, and any conflict with existing practice.
- Write the answers to `.agentic/config.json` as the first file of step 4.

## 4. Install

Read a module's reference only if that module is enabled. Install in this
order, because later modules link to earlier ones:

| # | Module | Reference | Default (Light / Standard / Full) |
|---|---|---|---|
| 1 | Context (always) | `references/modules/context.md` | on / on / on |
| 2 | Backlog | `references/modules/backlog.md` | on / on / on |
| 3 | Plans | `references/modules/plans.md` | off / on / on |
| 4 | Expertise store | `references/modules/expertise.md` | off / off / ask |
| 5 | Guardrails | `references/modules/guardrails.md` | on / on / on |
| 6 | Verify | `references/modules/verify.md` | off / on / on |
| 7 | Ship gate | `references/modules/ship-gate.md` | off / on / on |
| 8 | Cloud sessions | `references/modules/cloud.md` | ask / ask / ask |
| 9 | Parallel sessions | `references/modules/parallel.md` | off / off / ask |
| 10 | Workflow and maintenance | `references/modules/workflow.md` | folded into context / on / on |

Agent-specific files (context pointers, skill locations, hooks, how to start a
reviewer) come from `references/agent-adapters.md`. Write one canonical copy of
everything and give each agent a pointer to it. Never write the same rule into
two agents' files.

## 5. Verify

1. Run the repo's formatter over the files you installed (if it can run),
   then the repo's own checks (format, lint, typecheck, tests). Compare with
   what already failed in step 2: the scaffold must not add a failure. If the
   formatter couldn't run, say in the report that the repo's own pre-commit
   check may reject the installed files until someone runs it.
2. If the ship gate is installed, run its tests
   (`node --test .agentic/scripts/*.test.mjs`, glob unquoted).
3. Re-read every file you wrote for leftover template placeholders
   (`{{NAME}}`), and check that every repo path a doc mentions exists
   (relative to the file that mentions it) or is described as "created when
   first needed". Angle-bracket slots in files that are meant to stay
   templates (`docs/plans/TEMPLATE.md`, the kickoff prompt), example branch
   names, and paths inside a review directory are fine. Never cite this
   skill's own paths (`templates/…`, `references/…`) in a repo file.

## 6. Close out

1. Unless the user said otherwise in the interview, commit on a branch named
   in `closeOut.branch` (default `chore/agentic-scaffold`), in one commit whose
   message says what was installed and with which preset. Push and open a PR
   only if the user said to. The default branch name has no agent prefix on
   purpose: a person pushes it from their own terminal, since the gate it
   installs would refuse it from an agent session. Say so in the report.
2. If the ship gate is installed, now run its self-test
   (`node .agentic/scripts/gate-selftest.mjs`). It clones the committed
   history, turns hooks on the way a fresh clone would (or emulates the
   manager's hook when its tool isn't installed, and says so), and pushes
   through the real hook. It only sees commits, which is why it runs after
   the commit.
3. Report:
   - what was installed, and what was skipped and why;
   - which fallbacks are active (for example `BACKLOG.md` because seeds was not
     wanted);
   - every divergence from existing practice you kept;
   - steps only the user can take (accounts, secrets, cloud environments);
   - the one next step that would most improve the setup.

## Anti-patterns

- Installing a Full setup in a repo that can't use it. The scaffold must earn
  its keep; when in doubt, recommend the smaller preset.
- Duplicating an existing tracker, docs system or hook instead of extending it.
- Writing a rule in two places. One fact, one home; everything else links to it.
- Putting status or work in progress in the context file. It holds what is
  durably true.
- Letting best-effort tooling block an edit or commit. Guardrails nudge; gates
  gate.
- Installing a third-party tool the user did not explicitly choose after seeing
  the disclosure. "It's on PATH" and "take your recommendations" are not that.
- Recording personal or machine-specific details (local paths, account names)
  in repo files. Those belong in user defaults.
