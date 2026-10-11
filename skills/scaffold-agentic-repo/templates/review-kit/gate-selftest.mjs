#!/usr/bin/env node
/**
 * Proves the push gate is wired up in THIS repo, through whatever hook
 * manager it uses: clones the repo's COMMITTED history into a temp directory
 * with a local bare remote, turns hooks on the same way a fresh clone would,
 * then pushes a code change from a simulated agent session: once without a
 * review-loop summary (expects refusal), once with it (expects success), and
 * once to a branch without an agent prefix (expects refusal). Also checks that
 * the hook files are stored with LF line endings.
 *
 * Run it AFTER committing the scaffold (a clone only sees commits), from the
 * branch that holds it:
 *   node .agentic/scripts/gate-selftest.mjs [--hooks-on "<command>"] [--emulate]
 *
 * --hooks-on is the command that turns hooks on in a fresh clone, run with
 * `sh -c` (so it is POSIX shell on Windows too). Defaults by hook manager
 * (.agentic/config.json "modules.guardrails.hookManager"):
 *   none / githooks:   git config core.hooksPath .githooks
 *   husky:             npm install --ignore-scripts --no-audit --no-fund && npx --no-install husky
 *   lefthook:          lefthook install
 *   pre-commit:        pre-commit install
 *
 * --emulate skips the manager and points core.hooksPath at a temp directory
 * holding a stand-in for the hook the manager would generate. Use it when the
 * manager's tool isn't installed (offline, no dependencies). It proves the
 * gate and the entry, not the manager's own hook generation; the summary
 * says which was tested. The script falls back to --emulate on its own when
 * the activation command fails, and says so.
 *
 * Installed by scaffold-agentic-repo (templates/review-kit).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const config = JSON.parse(readFileSync(join(repo, ".agentic/config.json"), "utf8"));
const manager = config.modules?.guardrails?.hookManager ?? "none";
const prefix = (config.git?.agentBranchPrefixes ?? ["claude/"])[0];
const agentVar = (config.gate?.agentEnvVars ?? ["CLAUDECODE"])[0];

const HOOKS_ON = {
  none: "git config core.hooksPath .githooks",
  githooks: "git config core.hooksPath .githooks",
  husky: "npm install --ignore-scripts --no-audit --no-fund && npx --no-install husky",
  lefthook: "lefthook install",
  "pre-commit": "pre-commit install",
};
const argv = process.argv.slice(2);
const i = argv.indexOf("--hooks-on");
const hooksOn = i === -1 ? HOOKS_ON[manager] : argv[i + 1];
let emulate = argv.includes("--emulate");
if (!hooksOn && !emulate) fail(`no default --hooks-on for hook manager "${manager}"; pass one, or --emulate`);

let failures = 0;
function fail(msg) {
  failures++;
  console.error(`FAIL  ${msg}`);
}
function pass(msg) {
  console.log(`PASS  ${msg}`);
}

// 1. Hook files are LF. A CRLF checkout breaks `sh`.
for (const f of [".agentic/scripts/pre-push.sh", ".githooks/pre-push", ".husky/pre-push"]) {
  const p = join(repo, f);
  if (!existsSync(p)) continue;
  if (readFileSync(p, "utf8").includes("\r\n")) fail(`${f} has CRLF line endings; add it to .gitattributes with eol=lf and renormalize`);
  else pass(`${f} is LF`);
}

/** A stand-in for the hook each manager would generate, for --emulate. */
function emulatedHook(clone) {
  const dir = mkdtempSync(join(tmpdir(), "gate-hooks-"));
  const entry = join(dir, "pre-push");
  const script =
    manager === "pre-commit"
      ? // pre-commit passes one ref through the environment, not stdin.
        '#!/bin/sh\nread -r local_ref local_sha remote_ref remote_sha\n' +
        'PRE_COMMIT_REMOTE_NAME="$1" PRE_COMMIT_REMOTE_URL="$2" PRE_COMMIT_TO_REF="$local_sha" ' +
        'PRE_COMMIT_FROM_REF="$remote_sha" PRE_COMMIT_REMOTE_BRANCH="$remote_ref" PRE_COMMIT_LOCAL_BRANCH="$local_ref" ' +
        'node "$(git rev-parse --show-toplevel)/.agentic/scripts/loop-gate.mjs" --pre-commit\n'
      : '#!/bin/sh\nexec sh "$(git rev-parse --show-toplevel)/.agentic/scripts/pre-push.sh" "$@"\n';
  writeFileSync(entry, script);
  chmodSync(entry, 0o755);
  execFileSync("git", ["config", "core.hooksPath", dir.replace(/\\/g, "/")], { cwd: clone });
  return dir;
}

// 2. Clone, turn hooks on, push from a simulated agent session.
const tmp = mkdtempSync(join(tmpdir(), "gate-selftest-"));
try {
  const bare = join(tmp, "origin.git");
  const clone = join(tmp, "clone");
  const env = { ...process.env, [agentVar]: "1", CLAUDE_CODE_REMOTE: "" };
  const sh = (cmd) => spawnSync("sh", ["-c", cmd], { cwd: clone, encoding: "utf8", env });
  const git = (...a) => execFileSync("git", a, { cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  execFileSync("git", ["clone", "-q", "--bare", repo, bare]);
  execFileSync("git", ["clone", "-q", bare, clone]);
  git("config", "user.email", "selftest@example.com");
  git("config", "user.name", "gate-selftest");
  git("config", "core.autocrlf", "false");
  const base = git("rev-parse", "--abbrev-ref", "HEAD").trim();
  execFileSync("git", ["-C", bare, "symbolic-ref", "HEAD", `refs/heads/${base}`]);
  git("fetch", "-q", "origin");
  console.log(`info  testing the gate as committed on ${base}`);

  if (!emulate) {
    const on = sh(hooksOn);
    if (on.status !== 0) {
      console.log(`info  turning hooks on failed (${hooksOn}); falling back to --emulate\n      ${on.stderr.trim().split("\n")[0] ?? ""}`);
      emulate = true;
    } else pass(`hooks on (${hooksOn})`);
  }
  if (emulate) {
    emulatedHook(clone);
    pass(`hooks on (emulated ${manager} hook; the manager's own hook generation is not tested)`);
  }

  // The clone's commits are throwaway; the repo's own commit hooks (a format
  // check needing dependencies, say) must not get in the way.
  git("switch", "-q", "-c", `${prefix}gate-selftest`);
  writeFileSync(join(clone, "gate-selftest.tmp.js"), "// gate selftest\n");
  git("add", "gate-selftest.tmp.js");
  git("commit", "-q", "--no-verify", "-m", "gate selftest: code change");

  const r1 = sh(`git push -q origin ${prefix}gate-selftest`);
  if (r1.status === 0) fail("a code push with no review-loop summary was accepted; the hook is not running");
  else if (!/loop-gate/.test(r1.stderr)) fail(`the push was refused, but not by the loop gate:\n${r1.stderr}`);
  else pass("code push without a loop is refused");

  git("commit", "-q", "--no-verify", "--allow-empty", "-m", "review-loop: clean after 1 round");
  const r2 = sh(`git push -q origin ${prefix}gate-selftest`);
  if (r2.status !== 0) fail(`a push with the summary last was refused:\n${r2.stderr}`);
  else pass("push with the summary last is accepted");

  const r3 = sh(`git push -q origin HEAD:refs/heads/not-an-agent-branch`);
  if (r3.status === 0) fail("an agent session pushed to a branch without an agent prefix");
  else pass("agent session cannot push to a branch without an agent prefix");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\ngate-selftest: ${failures} failure(s)` : "\ngate-selftest: ok");
process.exitCode = failures ? 1 : 0;
