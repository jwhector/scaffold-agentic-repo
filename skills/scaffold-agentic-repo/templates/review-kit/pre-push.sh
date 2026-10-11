#!/bin/sh
#
# The loop gate, as a git pre-push hook. One canonical copy; every hook
# manager's pre-push entry just runs this script with the hook's arguments
# and stdin (see .agentic/config.json "guardrails.hookManager").
#
# Refuses to push code from an agent session, to an agent branch, or in a
# cloud session, unless review-loop ran and nothing that changes code came
# after its summary. Rules and settings: .agentic/scripts/loop-gate.mjs and
# .agentic/config.json.
#
# Bypass (a person, deliberately): git push --no-verify

repo=$(git rev-parse --show-toplevel) || exit 0
refs=$(cat)

if command -v node >/dev/null 2>&1; then
  printf '%s\n' "$refs" | node "$repo/.agentic/scripts/loop-gate.mjs" "$1" "$2"
  exit $?
fi

# No node: the gate cannot judge. Refuse only pushes to agent branches, so a
# person's own push never needs node. Prefixes are filled in at install time.
for prefix in {{AGENT_BRANCH_PREFIXES}}; do
  case "$refs" in
    *" refs/heads/$prefix"*)
      echo "pre-push: node is not installed, so the loop gate cannot run. Install it, or bypass with --no-verify." >&2
      exit 1
      ;;
  esac
done
exit 0
