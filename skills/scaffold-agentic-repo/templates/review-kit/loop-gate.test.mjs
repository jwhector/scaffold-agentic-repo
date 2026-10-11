import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide, evaluate, gating, isCode, isSummary, refsFromPreCommitEnv, refsToCheck } from "./loop-gate.mjs";
import { anySet, loadGateSettings } from "./config.mjs";

const SHA = "a".repeat(40);
const ZERO = "0".repeat(40);
const DATA = ["docs/", ".mulch/"];
const opts = { prefixes: ["claude/", "codex/"] };

test("agent branches are gated everywhere; other branches only in a cloud or agent session", () => {
  assert.equal(gating("claude/x", opts), "gate");
  assert.equal(gating("codex/x", opts), "gate");
  assert.equal(gating("someone/x", opts), "no");
  assert.equal(gating("someone/x", { ...opts, cloud: true }), "gate");
});

test("an agent session may only push to agent-prefixed branches", () => {
  assert.equal(gating("claude/x", { ...opts, agent: true }), "gate");
  assert.equal(gating("feature/x", { ...opts, agent: true }), "rename");
  assert.equal(gating("main", { ...opts, agent: true }), "rename");
});

test("deletions and tags are never checked", () => {
  assert.deepEqual(refsToCheck(`(delete) ${ZERO} refs/heads/claude/x ${SHA}\n`, opts), []);
  assert.deepEqual(refsToCheck(`refs/tags/v1 ${SHA} refs/tags/v1 ${ZERO}\n`, { ...opts, cloud: true, agent: true }), []);
  const [r] = refsToCheck(`refs/heads/claude/x ${SHA} refs/heads/claude/x ${ZERO}\n`, opts);
  assert.equal(r.branch, "claude/x");
  assert.equal(r.gating, "gate");
});

test("the pre-commit framework's environment is read like one stdin line", () => {
  const env = { PRE_COMMIT_TO_REF: SHA, PRE_COMMIT_REMOTE_BRANCH: "refs/heads/claude/x", PRE_COMMIT_FROM_REF: ZERO };
  const [r] = refsFromPreCommitEnv(env, opts);
  assert.equal(r.localSha, SHA);
  assert.equal(r.branch, "claude/x");
  assert.deepEqual(refsFromPreCommitEnv({}, opts), []);
  assert.deepEqual(refsFromPreCommitEnv({ PRE_COMMIT_TO_REF: ZERO, PRE_COMMIT_REMOTE_BRANCH: "refs/heads/claude/x" }, opts), []);
});

test("session markers: set, non-empty, and not false or 0", () => {
  assert.equal(anySet({ CLAUDE_CODE_REMOTE: "true" }, ["CLAUDE_CODE_REMOTE"]), true);
  assert.equal(anySet({ CLAUDE_CODE_REMOTE: "false" }, ["CLAUDE_CODE_REMOTE"]), false);
  assert.equal(anySet({ CLAUDE_CODE_REMOTE: "0" }, ["CLAUDE_CODE_REMOTE"]), false);
  assert.equal(anySet({}, ["CLAUDE_CODE_REMOTE"]), false);
  assert.equal(anySet({ AI_AGENT: "claude-code_2-1_agent" }, ["CLAUDECODE", "AI_AGENT"]), true);
});

test("only the exact summary subject counts", () => {
  assert.equal(isSummary("review-loop: clean after 1 round"), true);
  assert.equal(isSummary("review-loop: blocking after 3 rounds"), true);
  assert.equal(isSummary("review-loop r1: fix the null check"), false);
  assert.equal(isSummary("chore: review-loop: clean after 1 round"), false);
});

test("decide: no code passes; code needs a summary with nothing unreviewed after it", () => {
  const s = [{ sha: "s", subject: "review-loop: clean after 1 round" }];
  assert.equal(decide({ codeChanged: false, summaries: [], unreviewedAfter: () => 9 }).pass, true);
  assert.equal(decide({ codeChanged: true, summaries: [], unreviewedAfter: () => 0 }).pass, false);
  assert.equal(decide({ codeChanged: true, summaries: s, unreviewedAfter: () => 0 }).pass, true);
  assert.equal(decide({ codeChanged: true, summaries: s, unreviewedAfter: () => 2 }).pass, false);
});

test("a traversal path is code", () => {
  assert.equal(isCode("docs/x.md", DATA), false);
  assert.equal(isCode("docs/../src/a.ts", DATA), true);
  assert.equal(isCode(".\\docs\\x.md", DATA), false);
});

/** origin with main; a clone on claude/work with one code commit. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "loop-gate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  mkdirSync(repo);
  const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim();
  const put = (path, text) => {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
  };
  const commit = (msg, files = {}) => {
    for (const [p, text] of Object.entries(files)) put(p, text);
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", msg);
    return git("rev-parse", "HEAD");
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("config", "core.autocrlf", "false");
  git("remote", "add", "origin", origin);
  commit("base", {
    "src/a.ts": "1\n",
    ".agentic/config.json": JSON.stringify({ git: { agentBranchPrefixes: ["claude/"] }, gate: { dataPaths: DATA } }),
  });
  git("push", "-q", "origin", "main");
  git("fetch", "-q", "origin");
  git("switch", "-q", "-c", "claude/work");
  commit("change a", { "src/a.ts": "2\n" });
  const judge = () => evaluate({ cwd: repo, base: "origin/main", head: "HEAD", dataPaths: DATA });
  return { repo, git, commit, judge };
}

test("integration: code without a loop is refused; with the summary last it passes", (t) => {
  const f = fixture(t);
  assert.equal(f.judge().pass, false);
  f.commit("review-loop: clean after 1 round");
  assert.equal(f.judge().pass, true);
});

test("integration: code after the summary is refused; data after it is fine", (t) => {
  const f = fixture(t);
  f.commit("review-loop: clean after 1 round");
  f.commit("tick the backlog item", { "docs/backlog.md": "- [x] done\n" });
  assert.equal(f.judge().pass, true, "a data-only commit may follow the summary");
  f.commit("one more tweak", { "src/a.ts": "3\n" });
  const r = f.judge();
  assert.equal(r.pass, false);
  assert.match(r.why, /1 commit/);
});

test("integration: a commit made before the summary but merged in after it is unreviewed", (t) => {
  const f = fixture(t);
  f.git("switch", "-q", "-c", "side", "origin/main");
  f.commit("side change", { "src/b.ts": "side\n" });
  f.git("switch", "-q", "claude/work");
  f.commit("review-loop: clean after 1 round");
  f.git("merge", "-q", "--no-ff", "--no-edit", "side");
  const r = f.judge();
  assert.equal(r.pass, false, "ordering by date would have let this through");
});

test("integration: merging the base in after the loop does not count as unreviewed", (t) => {
  const f = fixture(t);
  f.commit("review-loop: clean after 1 round");
  f.git("switch", "-q", "main");
  f.commit("someone else's change on main", { "src/c.ts": "main\n" });
  f.git("push", "-q", "origin", "main");
  f.git("fetch", "-q", "origin");
  f.git("switch", "-q", "claude/work");
  f.git("merge", "-q", "--no-ff", "--no-edit", "origin/main");
  assert.equal(f.judge().pass, true);
});

test("integration: the gate's settings come from the base, not the branch", (t) => {
  const f = fixture(t);
  f.commit("loosen the gate", {
    ".agentic/config.json": JSON.stringify({ gate: { dataPaths: ["docs/", "src/"] } }),
  });
  const s = loadGateSettings(f.repo, { base: "origin/main" });
  assert.equal(s.fromBase, true);
  assert.deepEqual(s.dataPaths, DATA);
  assert.equal(evaluate({ cwd: f.repo, base: "origin/main", head: "HEAD", dataPaths: s.dataPaths }).pass, false);
});
