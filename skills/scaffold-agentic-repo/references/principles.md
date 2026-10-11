# Why the scaffold is shaped this way

Read this when the user asks why, or when a retrofit forces a judgment call and
you need the intent behind a rule rather than the rule.

## The repo describes itself

The most expensive part of starting an agent session is explaining the project.
If the repo carries that explanation, starting a session becomes "read the
context file and the docs it points to, then do this task". Every module serves
that: the context file says what is true now, decision records say why, the
backlog says what is left, the plan template says how work gets broken down,
and the verify skill says how to know it works.

## Knowledge has a temperature

Different knowledge is read at different rates, so it belongs in different
places:

- **Warm: the context file** (`AGENTS.md` and its per-agent pointers). Loaded
  into every session. Short and curated: what the project is, how it is
  organized, numbered rules, how to run, test and verify, and pointers to
  everything else. Every line costs context in every session, so it must earn
  its place.
- **Cold: decision records.** Read only when someone wants to change a decision.
  They hold the rationale and the rejected alternatives so the context file
  doesn't have to.
- **Hot: an expertise store** (optional). Small records of failures hit and
  conventions learned, pulled in by the files a session touches. Useful once a
  repo has accumulated lessons that are too specific for the context file.

**One fact, one home.** The rule lives in the context file and links to the
decision; the decision holds the why. When the same rule is written in two
places, one of them goes stale.

## Two rhythms

Planning is infrequent, led by a person and heavy on judgment. Execution is
frequent, done by agents and governed by rules. Planning fills the backlog;
execution drains it. Mixing them produces agents making product decisions
mid-task, or people micromanaging mechanical work.

Plans carry **acceptance criteria** per step, so an agent knows when it's done,
and an **early-exit clause** per step: the discovery that should make the agent
stop and ask instead of finishing (a much simpler fix, a blocking unknown, a
conflict with a ratified decision). Early exits are what keep an agent from
completing the wrong thing confidently.

## A person is not the first reviewer

By the time a person opens a PR, a machine review should already have run and
its findings should already be fixed. Three things make that work:

- **Independence.** The reviewer starts fresh every round and is not briefed by
  the author. It gets the intent from the commit messages. An author's framing
  is exactly what an independent review must not inherit.
- **Review where the fixes happen.** A reviewer that runs in CI after the push
  can only comment; the author has to come back. Reviewing in the session,
  before the push, means findings get fixed in the same sitting.
- **A gate that makes it happen.** Instructions are forgotten. A pre-push hook
  that refuses unreviewed code is not.

The gate is an attestation, not proof: it checks that the session recorded a
review, not that the review was good. The person's review is the check on that.
Say so wherever the gate is documented.

**Accrue commits, loop once, push once.** Every round is a full review and the
push is what puts work in front of a person. Pushing work in progress means
reviewing it repeatedly and notifying people about unfinished work.

## Checks are not verification

Passing tests prove the code is consistent with its tests, not that it does
what was asked. Verification means observing the behaviour: run the app and
drive the flow, run the script on real input, render the output and look at
it. The verify skill writes down how to do that in this specific repo.

## Friction becomes infrastructure, on a schedule

Every recurring annoyance (a flaky check, a step agents keep forgetting, a
question that keeps getting asked) is a candidate for a skill, a hook or a doc
fix. Doing this whenever something hurts leads to churn; never doing it leads
to rot. Once a week, pick the single most recurrent friction and convert it
into one piece of infrastructure. One a week compounds.

## Scale to the repo

Ceremony a repo can't amortize is worse than none. A script needs a context
file and a list of what's left. A product with several packages and parallel
agents needs the whole loop. The presets exist so the scaffold earns its keep
at every size.

## Respect what's there

In a retrofit, existing practice that people already rely on beats this
scaffold's version of it. Extend it, and note where it differs. Replacing a
working convention with a theoretically better one costs more than it gains.
