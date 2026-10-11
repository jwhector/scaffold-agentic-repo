# Module: Context (always installed)

## `AGENTS.md`

Short and curated. Aim for one screen in a Light repo and no more than a few
in a Full one; every line is loaded into every session. Sections:

1. **What this is**: two or three sentences.
2. **How it's organized, and why**: the top-level layout and the reason for it.
3. **Rules**: numbered, so reviews and records can cite them ("breaks rule 4").
   Only rules that are durably true and that an agent would otherwise get
   wrong. Each rule that has a decision behind it links to the record.
4. **Run, test, verify**: the exact commands. If the Verify module is on, link
   the verify skill for how to observe behaviour.
5. **Where things are**: pointers to decision records, the backlog, the plan
   template, the workflow doc, repo skills.
6. Module sections added later (cloud sessions, ship gate rhythm) go at the end.

Never put status, in-progress notes, dates of recent work or a changelog here.
They go stale and are loaded every time.

**Retrofit**: if an agent-specific file (`CLAUDE.md`, `GEMINI.md`,
`.github/copilot-instructions.md`, `.cursor/rules`) already holds real content,
move the durable parts into `AGENTS.md`, drop the stale parts (list them in the
report), and leave the pointer from `references/agent-adapters.md` in its place. If the
repo already has an `AGENTS.md`, edit it; don't restructure what works.

**Full, multi-package**: one root `AGENTS.md` plus one per package. Package
boundaries are context boundaries: a session loads only the packages it
touches. The root file covers what crosses packages; each package file covers
only that package. Agents that need a pointer file (Claude Code's `CLAUDE.md`)
need one per package too; see `references/agent-adapters.md`.

## Decision records (Standard and Full)

`docs/decisions/` (or the repo's existing ADR directory, whatever its format):

- `0000-template.md` from `templates/docs/decision-template.md`.
- `0001-agentic-workflow.md`: record this scaffold. The decision: which
  preset and modules were chosen and why; alternatives rejected (the modules
  left off, and why); divergences from this scaffold kept for existing
  practice.

The rule: the operative rule lives in `AGENTS.md` and links to the record; the
record holds the reasoning. A new decision that contradicts an old one
supersedes it explicitly (status line on both); never silently contradicts it.
Records are read when changing a decision, not as everyday reference, so
`AGENTS.md` must never require reading one to follow a rule.
