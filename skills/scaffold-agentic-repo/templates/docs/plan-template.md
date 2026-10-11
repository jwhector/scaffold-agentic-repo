# Plan: <title>

- **Backlog item:** <id>
- **Author / reviewer:** <who wrote it> / <who approves it>

## Context

What exists now, what's wrong or missing, and the constraints (decision
records, rules in `AGENTS.md`) the work has to respect.

## Approach

The chosen approach in a paragraph, and the main alternative considered and
why it wasn't chosen.

## Steps

Each step stays inside one boundary (a package, a module) where possible, so
independent steps can run in parallel.

### 1. <step>

- **Where:** <package or area>
- **Depends on:** <step numbers, or none>
- **Do:** what changes.
- **Acceptance criteria:**
  - <observable result, specific enough that a reviewer can check it>
  - <…>
- **Stop and ask if:** <the discovery that should end this step early: a much
  simpler fix exists, an unknown blocks it, it conflicts with decision NNNN>

### 2. <step>

…

## Risks

What could go wrong, and how we'd notice.

## Out of scope

What this plan deliberately doesn't do, so nobody "helpfully" does it.
