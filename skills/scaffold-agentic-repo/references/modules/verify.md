# Module: Verify

A change is not verified because checks pass. Checks prove the code agrees
with its tests, not that it does what was asked. Install a `verify` skill at
`.agents/skills/verify/SKILL.md` (with pointers per `references/agent-adapters.md`)
that says how to **observe** the affected behaviour in this specific repo.

Write it from what you learned in detection, specific to this repo. Not a
generic checklist. It should answer:

1. **How to run it**: the command to start the app, run the CLI, or execute the
   pipeline, and with what input.
2. **How to drive the change**: for a web app, which pages and flows; for a
   CLI, an example invocation; for a library, a short script that calls the
   changed API; for a data job, a small real input and what the output should
   look like.
3. **What counts as observed**: a screenshot, captured output, a rendered file.
   Something a reviewer could look at.
4. **What to do when it can't be observed** (no display, missing credentials):
   say so explicitly in the commit message. Don't claim it was verified.

Add when they apply:

- **A design source for the UI**: parity is a diff of two images, not a claim.
  Render, capture, compare.
- **Paid or external services**: a fakes switch. One environment variable that
  swaps model, mail, payment and other external calls for fakes, live by
  default. Document it in the verify skill; implementing the switch itself is
  a backlog item, not part of the scaffold, unless it already exists.

Description to use in the skill's frontmatter (adapt the nouns): "How to see a
change working in <repo>, not just passing checks. Use after building a change
and before the review loop or push."
