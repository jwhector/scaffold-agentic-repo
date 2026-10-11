# Module: Plans

Install `templates/docs/plan-template.md` as `docs/plans/TEMPLATE.md` (or the
directory chosen in the interview).

What makes this template different from a generic one, so keep these when
adapting it to an existing format:

- **Acceptance criteria per step.** The agent knows when the step is done, and
  the reviewer judges against them. Commit messages quote them.
- **An early-exit clause per step.** The discovery that should make the agent
  stop and ask instead of finishing: a much simpler fix, a blocking unknown, a
  conflict with a ratified decision. Without it, agents complete the wrong
  thing confidently.
- **Steps follow boundaries.** In a multi-package repo, a step stays inside one
  package where possible, so independent steps can run in parallel without
  colliding.

Add to `AGENTS.md`: before non-trivial changes, write a plan from the template
and get it reviewed by a person; small changes don't need one. If the repo
already defines "non-trivial", use its definition.

If the backlog backend can hold plans (seeds can), say where plans live and
don't duplicate them in `docs/plans/`.
