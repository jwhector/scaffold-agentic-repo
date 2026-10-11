# scaffold-agentic-repo

An agent skill that sets a repository up for AI coding agents: in a new repo,
or retrofitted onto one you already have. It asks you a few questions, then
installs the pieces you pick.

The idea behind it: **the repo describes itself, so starting a session is
"read the docs, here's the task"; planning and execution are separate
rhythms; agents get their work reviewed and fixed before a person looks; every
fact lives in exactly one place; and recurring friction gets turned into
infrastructure on a schedule.** The full reasoning is in
[principles.md](skills/scaffold-agentic-repo/references/principles.md).

It follows the open [Agent Skills](https://agentskills.io) format, so it
works in Claude Code, Codex, Gemini CLI, GitHub Copilot, Cursor and other
agents that read `SKILL.md`.

## Before you run it

You don't have to trust this blindly, and you shouldn't. Three ways to look
first, in increasing order of effort:

1. **Read it.** The whole skill is Markdown plus three small Node scripts:
   [SKILL.md](skills/scaffold-agentic-repo/SKILL.md) is the procedure,
   [references/](skills/scaffold-agentic-repo/references/) holds the
   reasoning and one file per module, and
   [templates/](skills/scaffold-agentic-repo/templates/) is exactly what gets
   copied into your repo. Nothing else is installed: no daemon, no background
   process, no network calls of its own.
2. **Have your own agent review it.** Open your repo, give your agent this
   repo's URL (or a clone of it), and paste:

   > Read the skill at `skills/scaffold-agentic-repo/` in that repo: `SKILL.md`,
   > everything in `references/`, and the files in `templates/`. Do not run
   > it. Then tell me:
   > 1. In plain terms, what it would do to this repo: every file it would
   >    create or change, and which of those are optional.
   > 2. What runs on my machine afterwards and when (git hooks, agent hooks,
   >    CI), and what each one can block.
   > 3. Anything that sends data anywhere, including the third-party tools it
   >    can offer.
   > 4. How it compares with how I work now: what I already have that it
   >    would keep, what it would replace, and what it adds that I'd have no
   >    equivalent for.
   > 5. The three things in it you'd push back on, and why.

3. **Run it and say no.** The skill writes nothing until you confirm. Its
   first reply is what it found, a recommended preset, every setting, and the
   list of files it would create or change, ending with a question. Answer
   "no" and your repo is untouched; the plan is yours to keep.

If you find something you'd push back on, open an issue. Disagreement with
the defaults is useful; that's why they're modules.

## Install

With the [skills CLI](https://skills.sh/docs/cli), for whichever agents you
have:

```bash
npx skills add jwhector/scaffold-agentic-repo
```

The skills CLI sends anonymous usage data by default; set
`DISABLE_TELEMETRY=1` to turn that off.

Or, in Claude Code, as a plugin (gets updates):

```
/plugin marketplace add jwhector/scaffold-agentic-repo
/plugin install scaffold-agentic-repo@scaffold-agentic-repo
```

## Use

In the repo you want to set up, ask your agent something like "set this repo
up for agents" or "scaffold the agentic workflow here".

It will:

1. **Look around** without changing anything: your stack, size, which agents
   you already use, your existing docs, trackers and hooks.
2. **Ask you once**: what it found, a recommended preset, and every setting
   with a recommended value, so you can answer in one reply.
3. **Install** what you chose, extending what you already have instead of
   duplicating it.
4. **Check** that nothing broke, commit on a branch, and report what it did
   and what's left for you.

Your answers are saved in `.agentic/config.json`, so running it again later
upgrades the setup or adds a module without asking everything again.

## Modules

| Module | What you get | Presets |
|---|---|---|
| **Context** | `AGENTS.md` as the one context file, small pointers for each agent, decision records | All (decision records from Standard) |
| **Backlog** | A dependency-aware list of work: your existing tracker, `BACKLOG.md`, or [seeds](https://github.com/jayminwest/seeds) | All |
| **Plans** | A plan template with acceptance criteria and "stop and ask if" per step | Standard, Full |
| **Expertise store** | Lessons learned, pulled in by the files a session touches, via [mulch](https://github.com/jayminwest/mulch) | Opt-in |
| **Guardrails** | Format-on-edit hooks and fast pre-commit checks. They nudge; they never block | All |
| **Verify** | A skill that says how to *see* a change working in this repo, not just pass checks | Standard, Full |
| **Ship gate** | A review loop: a fresh, read-only reviewer each round, fixes in the session, a pre-push gate on every push an agent makes, and a CI check as the backstop. Or [no-mistakes](https://github.com/kunchenguid/no-mistakes) locally | Standard, Full |
| **Cloud sessions** | Dependencies, git hooks and rules for agents running on cloud VMs | Asked every time |
| **Parallel sessions** | One worktree per agent for several local agents at once: plain `git worktree`, or reusable pooled ones via [treehouse](https://github.com/kunchenguid/treehouse) | Opt-in |
| **Workflow and maintenance** | The workflow doc, a standard kickoff prompt, and a weekly friction review | All (folded into `AGENTS.md` for Light) |

Presets: **Light** for scripts and small tools, **Standard** for a real
project, **Full** for multi-package products or parallel agents, or
**Custom**.

## Requirements

- `git`.
- `node` 18 or newer, if you install the ship gate (its scripts and tests are
  plain Node with no dependencies).
- Optional tools, used only if you choose them: `sd` (seeds), `ml` (mulch),
  `no-mistakes`, `treehouse`, `gh`. The skill tells you what each one installs
  and sends before recommending it.

## Personal defaults

If you set up many repos the same way, put your usual answers in
`~/.config/agentic-scaffold/defaults.json` (same format as
`.agentic/config.json`, any subset). They pre-fill the interview; they never
skip it, and personal details stay out of the repo.

## Status

`2.0.0-draft`. The Claude Code adapter is the one used in practice; the
adapters for other agents follow their public docs as of October 2026, and the
skill confirms locations before writing them. Reports from other agents are
welcome.

The ship gate is an attestation, not proof: it checks that a review was
recorded, not that it was good. Your review of the PR is still the real gate.

## Repository layout

```
skills/scaffold-agentic-repo/
  SKILL.md                 the procedure
  references/              loaded only when needed: interview, principles, agent adapters, one file per module
  templates/               copied into your repo: docs templates and the review kit (with tests)
evals/                     scenarios for testing changes to the skill
.claude-plugin/            Claude Code plugin and marketplace manifests
```

Run the review kit's tests with
`node --test skills/scaffold-agentic-repo/templates/review-kit/*.test.mjs`.
A scaffolded repo also gets `gate-selftest.mjs`, which clones it and pushes
through the real hook to prove the gate is wired up.

## License

MIT
