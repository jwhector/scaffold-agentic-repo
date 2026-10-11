#!/usr/bin/env node
/**
 * Scripted checks for the file-level expectations in evals.json. Judgment
 * expectations (tone of the interview, quality of AGENTS.md) are graded by
 * reading the run's report and files.
 *
 * Usage: node evals/check.mjs <eval id> <path to the scaffolded repo>
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [id, repo] = process.argv.slice(2);
if (!id || !repo) {
  console.error("usage: check.mjs <eval id> <repo>");
  process.exit(2);
}

const p = (...a) => join(repo, ...a);
const has = (f) => existsSync(p(f));
const read = (f) => (has(f) ? readFileSync(p(f), "utf8") : "");
const lines = (f) => read(f).split("\n").length;
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
const json = (f) => {
  try {
    return JSON.parse(read(f));
  } catch {
    return undefined;
  }
};
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const anyFileContains = (text) => walk(repo).some((f) => readFileSync(f, "utf8").includes(text));
const settings = () => json(".claude/settings.json") ?? {};
const hookCommands = (event) =>
  (settings().hooks?.[event] ?? []).flatMap((m) => (m.hooks ?? []).map((h) => h.command ?? ""));
const indexMode = (f) => {
  const out = git("ls-files", "-s", f);
  return out ? out.split(/\s+/)[0] : "(not committed)";
};
const kitTests = () => {
  try {
    execFileSync("node", ["--test", ".agentic/scripts/*.test.mjs"], { cwd: repo, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};
const gateSelftest = () => {
  try {
    // Unset this session's own agent markers: the selftest sets its own.
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.AI_AGENT;
    delete env.CLAUDE_CODE_REMOTE;
    execFileSync("node", [".agentic/scripts/gate-selftest.mjs", "--emulate"], { cwd: repo, stdio: "pipe", env });
    return true;
  } catch {
    return false;
  }
};
const hookEntry = () => [".githooks/pre-push", ".husky/pre-push"].find(has);
const hookExecutable = () => {
  const entry = hookEntry();
  return entry !== undefined && indexMode(entry) === "100755" && indexMode(".agentic/scripts/pre-push.sh") === "100755";
};
const hookFilled = () => !/\{\{AGENT_BRANCH_PREFIXES\}\}/.test(read(".agentic/scripts/pre-push.sh"));

const checks = {
  1: [
    ["AGENTS.md exists and is at most 80 lines (Light folds the workflow in)", () => has("AGENTS.md") && lines("AGENTS.md") <= 80],
    ["AGENTS.md names how to run rename_photos.py", () => /rename_photos\.py/.test(read("AGENTS.md"))],
    ["CLAUDE.md imports AGENTS.md and is short", () => /@AGENTS\.md/.test(read("CLAUDE.md")) && lines("CLAUDE.md") <= 12],
    ["no decision records, plans, review kit or pre-push", () =>
      !has("docs/decisions") && !has("docs/plans") && !has(".agentic/scripts") && !has(".githooks/pre-push") && !has(".agents/skills/review-loop")],
    ["format-on-edit hook exists and can't fail", () => {
      const cmds = hookCommands("PostToolUse");
      const scripts = has(".claude/hooks") ? walk(p(".claude/hooks")).map((f) => readFileSync(f, "utf8")) : [];
      const neverFails = (t) => /\|\|\s*(true|:)|exit 0/.test(t);
      return cmds.length > 0 && (cmds.every(neverFails) || scripts.some(neverFails));
    }],
    [".agentic/config.json has preset light", () => json(".agentic/config.json")?.preset === "light"],
  ],
  2: [
    ["AGENTS.md keeps the integer-cents rule", () => /cents/i.test(read("AGENTS.md"))],
    ["AGENTS.md keeps the endpoint-test rule", () => /endpoint/i.test(read("AGENTS.md"))],
    ["the stale status line is gone everywhere", () => !anyFileContains("Working on the PDF export this sprint")],
    ["CLAUDE.md is a pointer to AGENTS.md", () => /@AGENTS\.md/.test(read("CLAUDE.md")) && lines("CLAUDE.md") <= 12],
    ["no BACKLOG.md; AGENTS.md points to Issues with 'ready'", () => !has("BACKLOG.md") && /ready/.test(read("AGENTS.md"))],
    [".husky/pre-commit still runs prettier", () => /prettier/.test(read(".husky/pre-commit"))],
    ["config has branch prefixes for claude and codex", () => {
      const pre = json(".agentic/config.json")?.git?.agentBranchPrefixes ?? [];
      return pre.some((x) => /claude/.test(x)) && pre.some((x) => /codex/.test(x));
    }],
    ["review-kit tests pass", kitTests],
    ["hook entry and pre-push.sh are 100755 and filled in", () => hookExecutable() && hookFilled()],
    ["config records hookManager husky", () => json(".agentic/config.json")?.modules?.guardrails?.hookManager === "husky"],
    ["package.json has a prepare script for husky", () => /husky/.test(json("package.json")?.scripts?.prepare ?? "")],
    ["config has reviewers map with a default", () => Boolean(json(".agentic/config.json")?.review?.reviewers?.default)],
    ["canonical review-loop skill plus a Claude pointer", () =>
      has(".agents/skills/review-loop/SKILL.md") &&
      /\.agents\/skills\/review-loop/.test(read(".claude/skills/review-loop/SKILL.md")) &&
      lines(".claude/skills/review-loop/SKILL.md") <= 15],
    ["SessionStart: cloud-only install and hooksPath", () => {
      const cmds = hookCommands("SessionStart").join("\n");
      return /CLAUDE_CODE_REMOTE/.test(cmds) && /core\.hooksPath/.test(cmds);
    }],
    ["decision 0001 exists", () => has("docs/decisions") && readdirSync(p("docs/decisions")).some((f) => /^0001-/.test(f))],
    ["no third-party tool files", () => !has(".mulch") && !has(".seeds") && !has("treehouse.toml") && !has(".no-mistakes.yaml")],
  ],
  3: [
    ["root AGENTS.md keeps the original sentence (possibly extended)", () => /The acme product: an API\b.*\bweb app/.test(read("AGENTS.md"))],
    ["per-package AGENTS.md files", () => has("packages/api/AGENTS.md") && has("packages/web/AGENTS.md")],
    ["plan template has acceptance criteria and stop-and-ask", () =>
      /Acceptance criteria/i.test(read("docs/plans/TEMPLATE.md")) && /Stop and ask if/i.test(read("docs/plans/TEMPLATE.md"))],
    ["CI check checks out the base sha", () => /pull_request\.base\.sha/.test(read(".github/workflows/review-loop-check.yml"))],
    ["parallel sessions via git worktree, no treehouse", () =>
      !has("treehouse.toml") && walk(p("docs")).some((f) => /git worktree/.test(readFileSync(f, "utf8")))],
    ["no cloud dependency-install hook", () => !/CLAUDE_CODE_REMOTE/.test(hookCommands("SessionStart").join("\n"))],
    ["SessionStart turns hooks on (local repo too)", () => /hooksPath/.test(hookCommands("SessionStart").join("\n"))],
    ["per-package CLAUDE.md pointers", () => /@AGENTS\.md/.test(read("packages/api/CLAUDE.md")) && /@AGENTS\.md/.test(read("packages/web/CLAUDE.md"))],
    ["workflow doc says to rename non-prefixed branches", () => walk(p("docs")).some((f) => /git branch -m/.test(readFileSync(f, "utf8")))],
    ["review-kit tests pass", kitTests],
    ["hook entry and pre-push.sh are 100755 and filled in", () => hookExecutable() && hookFilled()],
    ["gate self-test passes", gateSelftest],
  ],
  5: [
    ["AGENTS.md exists", () => has("AGENTS.md")],
    [".pre-commit-config.yaml still has the existing ruff hook", () => /ruff/.test(read(".pre-commit-config.yaml"))],
    [".pre-commit-config.yaml has a local pre-push hook running loop-gate --pre-commit", () =>
      /loop-gate\.mjs --pre-commit/.test(read(".pre-commit-config.yaml")) && /pre-push/.test(read(".pre-commit-config.yaml"))],
    ["config records hookManager pre-commit", () => json(".agentic/config.json")?.modules?.guardrails?.hookManager === "pre-commit"],
    ["no .githooks or .husky entry was added", () => !has(".githooks/pre-push") && !has(".husky/pre-push")],
    ["pre-push.sh is 100755 and filled in", () => indexMode(".agentic/scripts/pre-push.sh") === "100755" && hookFilled()],
    ["review-kit tests pass", kitTests],
    ["no third-party tool files", () => !has(".mulch") && !has(".seeds") && !has("treehouse.toml") && !has(".no-mistakes.yaml")],
  ],
  4: [
    ["nothing written (clean tree, one commit)", () => git("status", "--porcelain") === "" && git("rev-list", "--count", "HEAD") === "1"],
  ],
};

const list = checks[id];
if (!list) {
  console.error(`no checks for eval ${id}`);
  process.exit(2);
}
let failed = 0;
for (const [name, fn] of list) {
  let ok = false;
  try {
    ok = Boolean(fn());
  } catch {}
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
console.log(`\neval ${id}: ${list.length - failed}/${list.length} passed`);
let branch = "";
try {
  branch = git("branch", "--show-current");
} catch {}
console.log(`branch: ${branch}; commits: ${git("rev-list", "--count", "HEAD")}; uncommitted: ${git("status", "--porcelain").split("\n").filter(Boolean).length}`);
process.exitCode = failed ? 1 : 0;
