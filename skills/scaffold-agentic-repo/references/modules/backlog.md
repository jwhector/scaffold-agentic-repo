# Module: Backlog

Work, not knowledge. The backlog says what is left to do and what blocks what.

**The invariant, whatever the backend: visible means work remains.** Anything
nobody intends to act on is closed, not left open. An open item is a promise.

## Backends

**Existing tracker** (GitHub Issues, Linear, Jira, …): if the repo already has
one in use, keep it. Add to `AGENTS.md` how agents find work (a label or
query), how they record dependencies (the tracker's own links, or a
`blocked-by: #12, #15` line in the body), and how they close items. Don't
install a second backlog.

**`markdown`** (default fallback): `BACKLOG.md` at the root, from
`templates/docs/BACKLOG.md`. Replace the placeholder item with real gaps
detection found (a missing lockfile, checks that can't run, a rule with no
test behind it) and, if the friction review is on, its standing item. One
line per item:

```
- [ ] B-012 Add retry to the upload client (blocked-by: B-009)
- [x] B-009 Extract the HTTP layer
- [~] B-014 Migrate to the new auth API (snoozed until 2026-12-01)
```

Closing an item: tick it, and remove `blocked-by` references to it from other
items. Keep ticked items only until the next friction review (Light: "now and
then"), then delete them; git keeps the history. Add `BACKLOG.md` to
`gate.dataPaths` so backlog updates never owe a review.

Claiming an item when sessions run in parallel: the branch name carries the
item id (`claude/B-012-upload-retry`), and a session checks
`git branch -a --list '*B-012*'` before starting. Two sessions on one item is
the collision to avoid; the branch list is the only shared state a Markdown
backlog has.

**`seeds`** ([jayminwest/seeds](https://github.com/jayminwest/seeds)), if `sd`
is installed and the user chose it: run `sd init`. Plans decompose into seeds
with a dependency graph, and closing a seed unblocks its dependents. Add its
data directory to `gate.dataPaths`. Before recommending it, read its README for
the install method and anything it sends over the network, and include that in
the interview's disclosure.

## What to add to `AGENTS.md`

Two or three lines: where the backlog is, how to claim an item, how to close
one, and the invariant above.
