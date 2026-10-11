# Module: Parallel sessions (opt-in)

For people who run several agents at once on the same repo, on their own
machine. Each agent needs its own checkout, or they overwrite each other's
work. Skip this module when sessions run only in the cloud: each already gets
its own machine.

If the agent tool can create a worktree per session itself (Claude Code's
`--worktree` flag, for instance), that covers isolation; this module then adds
the conventions (one task per worktree, where worktrees live, branch naming)
and, with treehouse, warm dependency reuse. Whatever creates the worktree,
**the branch must start with an agent prefix** before it is pushed; the push
gate refuses an agent-session push to any other branch, and the CI check only
recognises prefixed branches. Say so in the workflow doc, with the rename
command (`git branch -m claude/<topic>`).

## Backend: `git-worktree` (default)

Plain `git worktree add ../<repo>.worktrees/<branch> -b claude/<topic>`.
Dependencies install fresh in each worktree. The workflow doc gets:

- one task, one worktree, one branch per session;
- where worktrees live (default: a sibling directory `../<repo>.worktrees/`);
- how to claim a backlog item without colliding (see `backlog.md`);
- `git worktree remove` when the PR is merged.

## Backend: `treehouse` (opt-in, with disclosure)

[kunchenguid/treehouse](https://github.com/kunchenguid/treehouse)
keeps a pool of reusable git worktrees per repo; each agent gets an isolated
one instantly, and on exit it is reset and returned to the pool with its
dependencies and build cache intact. No daemon. Disclose in the interview, from
its current README: the standard install is a piped shell script (`curl … | sh`,
or `irm … | iex` on Windows; Nix, `go install` and source builds are
alternatives), and it is maintained mainly by one person.

Install:

1. `treehouse init` to create `treehouse.toml`; set `base_branch` to the
   default branch and a `max_trees` cap that matches how many agents the user
   actually runs.
2. A committed `.worktreeinclude` listing the untracked local files every
   worktree needs (`.env.local`, local config). Never list secrets the user
   wouldn't want copied around; ask.
3. If the stack's install is slow, a `post_create` hook in `treehouse.toml`
   that runs it, so a new worktree arrives ready.
4. In the workflow doc: one task per worktree; start with `treehouse`, work,
   `exit` to return it; plan steps split along package boundaries so parallel
   agents don't edit the same files; the ship-gate rhythm applies per
   worktree.

Everything in the `git-worktree` section still applies; treehouse replaces
only the create/return steps.
