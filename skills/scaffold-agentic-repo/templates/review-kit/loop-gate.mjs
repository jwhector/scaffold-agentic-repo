#!/usr/bin/env node
/**
 * The loop gate: code reaches a person only after the review-loop skill ran
 * over it, and nothing that changes code came after the loop's summary.
 *
 * An agent's push is what puts its work in front of a person (it opens or
 * updates the PR), so "review before the PR" means "review before the push".
 *
 * Gated:
 *   - every push made from an agent session (gate.agentEnvVars; a person's own
 *     terminal has none of those set), whatever the branch is called. From an
 *     agent session, a push to a branch without an agent prefix is refused
 *     outright: rename it, so the CI check can tell it is agent work;
 *   - every push in a cloud session (gate.cloudEnvVars);
 *   - any push to a branch with an agent prefix (git.agentBranchPrefixes).
 * Pushes to remotes in gate.skipRemotes are not gated here, because pushing
 * there is itself a gate.
 *
 * Passes when:
 *   - no code changed against the base (only gate.dataPaths), or
 *   - some commit `review-loop: <clean|concerns|blocking> after <N> round(s)`
 *     on the branch has no code-changing commit after it. "After" is ancestry,
 *     not date: a commit made before the summary but merged in after it is
 *     after it. Commits that only touch data paths may follow the summary.
 *
 * `blocking` passes: the loop ran, and its verdict is a person's to read.
 *
 * This is an attestation, not proof. The summary is written by the session
 * itself, and the final round's fixes are not re-reviewed when the round cap
 * is hit. It stops a forgotten loop and work committed after it. The person's
 * review is the check on the rest. A person may bypass with
 * `git push --no-verify`.
 *
 * Usage:
 *   pre-push hook:  node .agentic/scripts/loop-gate.mjs <remote-name> <remote-url> < refs
 *   pre-commit fw:  node .agentic/scripts/loop-gate.mjs --pre-commit
 *                   (reads PRE_COMMIT_REMOTE_NAME, PRE_COMMIT_TO_REF, PRE_COMMIT_REMOTE_BRANCH)
 *   CI:             node .agentic/scripts/loop-gate.mjs --check --head <sha> --branch <name> [--base <ref>]
 *
 * Settings: .agentic/config.json, read from the base branch (see config.mjs).
 * Installed by scaffold-agentic-repo (templates/review-kit).
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isAgentSession, isCloud, loadGateSettings } from "./config.mjs";

const SUMMARY = /^review-loop: (clean|concerns|blocking) after (\d+) rounds?\b/;
const ZERO = /^0+$/;

export function isCode(path, dataPaths) {
  const p = path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!p) return false;
  if (p.split("/").includes("..")) return true;
  return !dataPaths.some((prefix) => p.startsWith(prefix));
}

export const hasAgentPrefix = (branch, prefixes) => prefixes.some((prefix) => branch.startsWith(prefix));

/**
 * @param {string} branch
 * @param {{ prefixes: string[], cloud?: boolean, agent?: boolean }} opts
 * @returns {"no" | "gate" | "rename"} rename: an agent session pushing a branch without an agent prefix
 */
export function gating(branch, { prefixes, cloud = false, agent = false }) {
  const prefixed = hasAgentPrefix(branch, prefixes);
  if (agent && !prefixed) return "rename";
  return prefixed || cloud || agent ? "gate" : "no";
}

export function refsToCheck(input, opts) {
  return input
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((f) => f.length === 4)
    .map(([, localSha, remoteRef]) => ({ localSha, remoteRef }))
    .filter(({ localSha, remoteRef }) => !ZERO.test(localSha) && remoteRef.startsWith("refs/heads/"))
    .map((r) => ({ ...r, branch: r.remoteRef.slice("refs/heads/".length) }))
    .map((r) => ({ ...r, gating: gating(r.branch, opts) }))
    .filter((r) => r.gating !== "no");
}

/** The pre-commit framework passes one ref through the environment instead of stdin. */
export function refsFromPreCommitEnv(env, opts) {
  const localSha = env.PRE_COMMIT_TO_REF ?? "";
  const remoteRef = env.PRE_COMMIT_REMOTE_BRANCH ?? "";
  if (!localSha || !remoteRef) return [];
  return refsToCheck(`${remoteRef} ${localSha} ${remoteRef} ${env.PRE_COMMIT_FROM_REF ?? "0".repeat(40)}\n`, opts);
}

export const isSummary = (subject) => SUMMARY.test(subject.trim());

/**
 * @param {{
 *   codeChanged: boolean,
 *   summaries: { sha: string, subject: string }[],   newest first
 *   unreviewedAfter: (sha: string) => number,        code-changing commits after it
 * }} input
 * @returns {{ pass: boolean, why: string }}
 */
export function decide({ codeChanged, summaries, unreviewedAfter }) {
  if (!codeChanged) return { pass: true, why: "no code changed" };
  if (summaries.length === 0) {
    return { pass: false, why: "review-loop never ran (no `review-loop:` summary commit)" };
  }
  let fewest = Infinity;
  for (const s of summaries) {
    const n = unreviewedAfter(s.sha);
    if (n === 0) return { pass: true, why: s.subject };
    fewest = Math.min(fewest, n);
  }
  return { pass: false, why: `${fewest} commit(s) changing code came after the review-loop summary and were never reviewed` };
}

const git = (cwd, args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
const lines = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Judges one head against a base, using git in `cwd`. */
export function evaluate({ cwd = process.cwd(), base, head, dataPaths }) {
  const code = (paths) => paths.some((p) => isCode(p, dataPaths));
  const codeChanged = code(lines(git(cwd, ["diff", "--name-only", "--no-renames", `${base}...${head}`])));
  const summaries = lines(git(cwd, ["log", "--no-merges", "--format=%H%x09%s", `${base}..${head}`]))
    .map((l) => {
      const i = l.indexOf("\t");
      return { sha: l.slice(0, i), subject: l.slice(i + 1) };
    })
    .filter((c) => isSummary(c.subject));
  const unreviewedAfter = (sha) =>
    lines(git(cwd, ["rev-list", "--no-merges", head, `^${sha}`, `^${base}`])).filter((c) =>
      code(lines(git(cwd, ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", c]))),
    ).length;
  return decide({ codeChanged, summaries, unreviewedAfter });
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function hasRef(cwd, ref) {
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort refresh of the base, so the gate does not judge against a stale one. */
function refresh(cwd, base, remote) {
  const branch = base.startsWith(`${remote}/`) ? base.slice(remote.length + 1) : undefined;
  if (!branch) return;
  try {
    git(cwd, ["fetch", "--quiet", remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`]);
  } catch {
    console.error(`loop-gate: could not fetch ${base}; judging against the local copy.`);
  }
}

function judgeRefs(refs, settings) {
  const cwd = process.cwd();
  refresh(cwd, settings.base, settings.remote);
  if (!hasRef(cwd, settings.base)) {
    console.error(`loop-gate: ${settings.base} is missing. Run \`git fetch ${settings.remote}\` and push again.`);
    return 1;
  }
  let refused = 0;
  for (const { localSha, branch, gating: g } of refs) {
    if (g === "rename") {
      refused++;
      console.error(
        `loop-gate: refusing to push ${branch} from an agent session: agent work goes on a branch starting with ` +
          `${settings.agentBranchPrefixes.join(" or ")}. Rename it (git branch -m ${settings.agentBranchPrefixes[0]}<topic>) and push again.`,
      );
      continue;
    }
    const r = evaluate({ cwd, base: settings.base, head: localSha, dataPaths: settings.dataPaths });
    if (r.pass) continue;
    refused++;
    console.error(`loop-gate: refusing to push ${branch}: ${r.why}.`);
  }
  if (refused === 0) return 0;
  console.error(
    "loop-gate: run the review-loop skill once the work is complete; nothing that changes code may follow its summary.\n" +
      "  Changed code after the loop? Run it again. A person may bypass deliberately with `git push --no-verify`.",
  );
  return 1;
}

function sessionOpts(settings) {
  return {
    prefixes: settings.agentBranchPrefixes,
    cloud: isCloud(process.env, settings.cloudEnvVars),
    agent: isAgentSession(process.env, settings.agentEnvVars),
  };
}

async function prePush(argv) {
  const remoteName = argv[0] ?? "";
  const settings = loadGateSettings(process.cwd());
  if (settings.skipRemotes.includes(remoteName)) return 0;
  const refs = refsToCheck(await readStdin(), sessionOpts(settings));
  return refs.length === 0 ? 0 : judgeRefs(refs, settings);
}

function preCommitFramework() {
  const settings = loadGateSettings(process.cwd());
  if (settings.skipRemotes.includes(process.env.PRE_COMMIT_REMOTE_NAME ?? "")) return 0;
  const refs = refsFromPreCommitEnv(process.env, sessionOpts(settings));
  return refs.length === 0 ? 0 : judgeRefs(refs, settings);
}

function check(argv) {
  const head = arg(argv, "--head");
  const branch = arg(argv, "--branch");
  if (!head || !branch) {
    console.error("usage: loop-gate.mjs --check --head <sha> --branch <name> [--base <ref>]");
    return 2;
  }
  const settings = loadGateSettings(process.cwd(), { base: arg(argv, "--base") });
  if (!hasAgentPrefix(branch, settings.agentBranchPrefixes)) {
    console.log(`loop-gate: ${branch} is not an agent branch; no loop expected.`);
    return 0;
  }
  const r = evaluate({ base: settings.base, head, dataPaths: settings.dataPaths });
  console.log(`loop-gate: ${r.pass ? "pass" : "fail"}: ${r.why}.`);
  return r.pass ? 0 : 1;
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === "--check") process.exitCode = check(argv);
    else if (argv[0] === "--pre-commit") process.exitCode = preCommitFramework();
    else process.exitCode = await prePush(argv);
  } catch (e) {
    console.error(`loop-gate: ${e.message}`);
    process.exitCode = 1;
  }
}
