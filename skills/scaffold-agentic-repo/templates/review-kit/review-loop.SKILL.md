---
name: review-loop
description: Review your own committed change with a fresh, independent, read-only reviewer, fix what it finds, and repeat until it is clean, before you push. Use when the work is complete and verified and you are about to push, or when asked to "review and fix before pushing", "get this ready for review", or "run the review loop".
---

<!-- Canonical copy. Agent-specific pointer skills repeat only the description
above; if you change it, change theirs too. -->

# Skill: review-loop

This loop is the whole machine review a change gets. A fresh, read-only
reviewer reads the committed branch; you fix what has one right answer, leave a
person's decisions for them, and repeat. Nothing reviews the code again after
the push, so what this loop leaves is what the person reads.

Settings are in `.agentic/config.json`: `review.maxRounds` (default 3),
`review.reviewers` (one entry per agent, plus `default`), `git.remote`,
`git.defaultBranch`.

## Once, at the end, then push once

Every round is a full review, and a person waits on all of them. So:

- **Accrue commits; don't push as you go.** Commit as often as you like, but
  keep the work local until it is complete: built, verified, closed out. Then
  loop **once**, over the whole change, and push **once**.
- **Pushing means "ready for a person".** It opens or updates the PR, and every
  later push of new code needs a loop of its own.
- **The push gate enforces this** (the pre-push hook →
  `.agentic/scripts/pre-push.sh` → `loop-gate.mjs`). It refuses to push code
  from an agent session unless a loop summary has no code-changing commit
  after it, and refuses to push to a branch that doesn't start with an agent
  prefix at all (rename it: `git branch -m <prefix><topic>`). If it refuses
  you, you skipped the loop or changed code after it. Never bypass it with
  `--no-verify`; that is for a person.
- A change that only touches data paths (`gate.dataPaths`) owes no loop.
  Data-only commits (a backlog tick, an expertise record) may also come after
  the summary.

## Before you start

- The work is **committed** on its branch. The reviewer reads committed
  history, not your working tree.
- The repo's checks pass, and if there is a `verify` skill, you followed it and
  your commits say what you observed. Reviewing code that fails its own tests
  wastes a round.
- The commit messages say what was asked, what you decided and what you left
  out, and quote the acceptance criteria of the backlog item or plan step. That
  is the intent the reviewer judges against, and the only briefing it gets.
- Fetch the base: `git fetch <remote> <default branch>`.

## Each round (at most `review.maxRounds`)

1. **Lay out the materials** in a new directory outside the repo:

   ```bash
   DIR="$(mktemp -d)/review-r<N>"
   node .agentic/scripts/review-materials.mjs --base <remote>/<default branch> --head HEAD --dir "$DIR"
   ```

2. **Start a new reviewer** with exactly this message and nothing else:
   `Review directory: <DIR>. Branch: <branch>.`
   Use the `review.reviewers` entry for the agent you are, else `default`:
   - `"kind": "subagent"`: spawn this agent's `reviewer` subagent (for Claude
     Code, `.claude/agents/reviewer.md`).
   - `"kind": "command"`: run the command with the message as its final
     argument and `$DIR/head` as the working directory, and save its output to
     `$DIR/review.md`.
   If the entry fails (not installed, no credentials), say so and try, in
   order: your own read-only subagent if you have one, any other configured
   command. If none works, stop and tell the person. Never skip the round.

   Don't explain the change and don't point the reviewer at anything. Never
   continue an earlier round's reviewer: one that re-reads its own advice is
   not independent.

3. **Clean up**: `git -c core.longpaths=true worktree remove --force "$DIR/head"`.
   (The flag matters only on Windows, where deep paths otherwise fail.)

4. **Stop if the verdict is `clean`**, or if only nits remain. Fix a nit only
   when the fix is trivial and certain.

5. **Triage every `blocking` and `concern` finding** into exactly one of:
   - **Fix.** It is a bug, a missing test, or a broken rule, and there is one
     clear right answer within what the change set out to do. Fix it, rerun the
     affected checks, and commit with the subject `review-loop r<N>: <what>`.
     In the body, map each finding to its fix.
   - **Leave for a person.** It challenges a decision the person who asked for
     the work made deliberately, needs a product judgment, or needs a new
     decision record. Don't change the code to make the finding go away, and
     don't guess at the answer.
   - **Disagree.** The reviewer is wrong. Say why, with evidence (`file:line`,
     a test, a record id). Don't change anything.

   Record "left for a person" and "disagree" in the round's commit body too
   (use `--allow-empty` if the round fixed nothing), so the next reviewer sees
   them. If the review has a **Worth recording** command and your fix confirms
   it, run it before you commit the fix and stage the record with it.

6. **Stop if this round fixed nothing.** Another round would see the same
   thing. Otherwise start the next round.

## After the loop

Write the outcome into history, where the person reads it first:

```bash
git commit --allow-empty -m "review-loop: <last verdict> after <N> rounds" -m "<summary>"
```

Keep that subject exact. Anything that changes code must come before it. If
you change code after the loop, run the loop again.

The summary lists:
- each finding fixed, one line each;
- each finding **left for a person**, with the question they need to answer;
- each finding you **disagreed** with, with your evidence;
- anything still `blocking`;
- if the round cap was hit, that the last round's fixes were not re-reviewed.

Then push, once. Two exceptions:

- **A bug still `blocking` after the last round** means the work is not done.
  Stop and tell the person. If you are running unattended, drop the code first
  (`git reset --hard <remote>/<default branch>`; committed code would otherwise
  still be on the branch and the gate would refuse the push), record what is
  left in the backlog, and push only that.
- **A `blocking` finding left for a person** is fine to push. Deciding it is
  what the human review is for. Say so in your final message.
