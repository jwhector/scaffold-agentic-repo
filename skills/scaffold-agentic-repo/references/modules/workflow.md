# Module: Workflow and maintenance

Write `docs/agentic-workflow.md` (Standard and Full). In Light, fold the loop,
the kickoff prompt and the maintenance rules into a short section of
`AGENTS.md` instead, and use the Light variants marked below: Light text must
not refer to decision records, the friction review or `.agents/skills/`
unless they exist.

## The workflow doc

1. **The loop in one line**, naming only what is installed. For example:
   `plan → claim → build → verify → review loop → push → close (unblocks next)`.
   Drop the steps whose modules are off.
2. **Two rhythms.** Planning is infrequent, led by a person, heavy on judgment.
   Execution is frequent, done by agents, governed by rules. Planning fills the
   backlog; execution drains it.
3. **The kickoff prompt**, the repo's standard way to start a session, so
   nobody re-explains the project:

   > Read AGENTS.md and the docs it points to (in full for anything relevant to
   > the task). Then: <the task>. Before non-trivial changes, write a short plan
   > from the template and let me review it. Follow the conventions and use the
   > repo's skills.

4. **What's automatic, what's nudged, what's judgment**: a short table. For
   example: formatting (automatic, hook); the review loop before a push
   (enforced, gate); verification (nudged, skill); plans for non-trivial work
   (judgment).
5. **What the ship gate does and doesn't guarantee**, if installed (see
   `ship-gate.md`).
6. **Model choice** (optional, only if the user wants a policy): mechanical,
   low-judgment work (sweeps, triage) can go to a cheaper model; changes to
   auth, credentials or money get a second reviewer on a different model, and
   a disagreement between them is a finding.

## Maintenance rules

Append to the workflow doc (or `AGENTS.md` in Light):

- A new ratified decision gets a decision record. It supersedes the old one
  explicitly; it never silently contradicts it. (Light: "a decision worth
  remembering gets a line under Rules, with its reason.")
- A new recurring task becomes a skill in `.agents/skills/` (created when the
  first one is needed), so it's repeatable.
- A change that alters how the repo is shaped updates the affected docs **in
  the same change**. Stale context is worse than none; fix it when noticed.
- **Weekly friction review** (if on): once a week, read the open backlog and
  recent failures (refused pushes, review findings that keep recurring, checks
  that keep failing), pick the single most recurrent friction, and turn it into
  one infrastructure item in the backlog. One a week. How it recurs: a
  standing item in the backlog that is never closed (mark it so; with an
  issue tracker, that is a standing issue the user creates, so list it as a
  user step), or a scheduled task if the agent tool runs them locally; only
  offer a cloud schedule when cloud sessions are in scope. (Light: "now and then, clear
  ticked items and turn the most recent annoyance into a rule or a script.")
