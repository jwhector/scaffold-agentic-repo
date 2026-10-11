# Module: Expertise store (opt-in)

The hot layer: small records of failures hit, decisions made and conventions
learned, pulled into a session by the files it touches. Worth it once a repo
has lessons too specific for `AGENTS.md` and too frequent for decision records.
Not worth it in a new or small repo; recommend it only when asked or when `ml`
is already installed.

**Backend: mulch** ([jayminwest/mulch](https://github.com/jayminwest/mulch)).
Before recommending it, read its README for the install method and anything it
sends over the network, and include that in the interview's disclosure.

Install:

1. `ml init`.
2. One domain per package or major concern.
3. In each domain, one thin `reference` record that indexes the decision
   records relevant to it, so priming a file surfaces the right decisions.
4. Add `.mulch/` to `gate.dataPaths`.
5. Add to `AGENTS.md`: how to prime before working on an area, and when to
   record (a failure that cost time, a convention that isn't obvious).

If the ship gate is on, the review kit already primes from the base branch for
the reviewer, and the reviewer can suggest records. `.mulch/` is a data path,
so committing records (`ml record`, `ml sync`) after the loop's summary is
fine; anything that changes code still comes before it.

No mulch, no hot layer. Don't imitate one with a hand-maintained file;
`AGENTS.md` carries the load until the tool exists.
