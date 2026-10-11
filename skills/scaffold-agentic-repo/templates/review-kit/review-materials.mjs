#!/usr/bin/env node
/**
 * Lays out what a code reviewer reads, the same way every round:
 *
 *   rules/         the review prompt and every context file (AGENTS.md,
 *                  CLAUDE.md, GEMINI.md, at any depth), from the BASE, at
 *                  their repo paths
 *   diff.patch     the change, base...head
 *   commits.txt    every commit base..head, full messages: the stated intent
 *   head/          the tree at head, a detached worktree, for context
 *   expertise.md   Mulch records for the changed files, primed from the base
 *
 * Everything that tells the reviewer how to judge (rules/, expertise.md) comes
 * from the base, never the branch: a branch must not steer its own review. If
 * the branch changes those files, the reviewer sees that in diff.patch and
 * judges the change itself. Only on a first install, when the base has no
 * review prompt yet, is the head's copy used, and rules/SOURCE says so.
 *
 * Mulch is primed from the base's .mulch/, extracted with `git archive` into a
 * scratch directory. (Mulch resolves .mulch/ through git worktrees to the main
 * checkout, so priming inside head/ would silently read the wrong one.)
 * Priming is best-effort: without `ml`, or without .mulch/ on the base,
 * expertise.md says so and the review goes on.
 *
 * Usage:
 *   node .agentic/scripts/review-materials.mjs --base <ref> --head HEAD --dir <dir>
 *
 * The caller removes head/ afterwards:
 *   git -c core.longpaths=true worktree remove --force <dir>/head
 *
 * Installed by scaffold-agentic-repo (templates/review-kit).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BIG = 256 * 1024 * 1024;
export const PROMPT = ".agentic/review-prompt.md";
export const CONTEXT_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"];

/** Every context file at `ref`, at any depth, as repo-relative paths. */
export function contextFilesAt(cwd, ref) {
  const out = execFileSync("git", ["ls-tree", "-r", "--name-only", ref], { cwd, encoding: "utf8", maxBuffer: BIG });
  return out.split("\n").filter((p) => CONTEXT_FILES.includes(basename(p)));
}

/**
 * @param {{ base: string, head: string, dir: string, cwd?: string, ml?: string[], budget?: number }} opts
 *   `ml` is the command that runs Mulch, as an argv prefix (tests pass a fake).
 * @returns {{ files: string[], primed: boolean, rulesFrom: "base" | "head" }}
 */
export function layOut({ base, head, dir, cwd = process.cwd(), ml = ["ml"], budget = 6000 }) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: BIG });
  const out = resolve(cwd, dir);
  mkdirSync(out, { recursive: true });

  // core.longpaths: on Windows, deep paths under a temp dir pass 260
  // characters and the checkout fails ("Filename too long"). A no-op elsewhere.
  git("-c", "core.longpaths=true", "worktree", "add", "--detach", join(out, "head"), head);
  writeFileSync(join(out, "diff.patch"), git("diff", "--no-color", `${base}...${head}`));
  writeFileSync(join(out, "commits.txt"), git("log", "--no-color", "--format=commit %h%n%B", `${base}..${head}`));
  const rulesFrom = copyRules({ cwd, base, head, out });

  const files = git("diff", "--name-only", "--no-renames", `${base}...${head}`).split("\n").filter(Boolean);
  const expertise = primeFromBase({ cwd, base, files, ml, budget });
  writeFileSync(join(out, "expertise.md"), expertise.text);
  return { files, primed: expertise.primed, rulesFrom };
}

function show(cwd, ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd, encoding: "utf8", maxBuffer: BIG, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return undefined;
  }
}

function copyRules({ cwd, base, head, out }) {
  const rules = join(out, "rules");
  mkdirSync(rules, { recursive: true });
  let prompt = show(cwd, base, PROMPT);
  const rulesFrom = prompt === undefined ? "head" : "base";
  if (prompt === undefined) prompt = show(cwd, head, PROMPT);
  if (prompt === undefined) throw new Error(`${PROMPT} is missing on both ${base} and ${head}`);
  writeFileSync(join(rules, basename(PROMPT)), prompt);
  const from = rulesFrom === "base" ? base : head;
  for (const file of contextFilesAt(cwd, from)) {
    const text = show(cwd, from, file);
    if (text === undefined) continue;
    mkdirSync(join(rules, dirname(file)), { recursive: true });
    writeFileSync(join(rules, file), text);
  }
  writeFileSync(
    join(rules, "SOURCE"),
    rulesFrom === "base"
      ? `These rules are from the base (${base}).\n`
      : `The base (${base}) has no review prompt yet (first install), so these rules are from the head (${head}).\n`,
  );
  return rulesFrom;
}

function primeFromBase({ cwd, base, files, ml, budget }) {
  if (files.length === 0) return { primed: false, text: "(No changed files, so no Mulch records.)\n" };

  const scratch = mkdtempSync(join(tmpdir(), "review-mulch-"));
  try {
    try {
      const tar = execFileSync("git", ["archive", "--format=tar", base, ".mulch"], {
        cwd, maxBuffer: BIG, stdio: ["ignore", "pipe", "pipe"],
      });
      // cwd, not -C: GNU tar on Windows (Git's) reads "C:\..." as host:path.
      execFileSync("tar", ["-x"], { cwd: scratch, input: tar });
    } catch {
      return { primed: false, text: `(The base ${base} has no .mulch/, so no Mulch records.)\n` };
    }
    const [cmd, ...pre] = ml;
    try {
      const text = execFileSync(cmd, [...pre, "prime", "--files", ...files, "--budget", String(budget)], {
        cwd: scratch, encoding: "utf8", maxBuffer: BIG, stdio: ["ignore", "pipe", "pipe"],
      });
      return { primed: true, text };
    } catch {
      return { primed: false, text: "(Mulch is not available here, so this review runs without recorded expertise.)\n" };
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  const base = arg(argv, "--base");
  const head = arg(argv, "--head");
  const dir = arg(argv, "--dir");
  if (!base || !head || !dir) {
    console.error("usage: review-materials.mjs --base <ref> --head <ref> --dir <dir>");
    process.exit(2);
  }
  const { files, primed, rulesFrom } = layOut({ base, head, dir });
  console.log(
    `Review materials in ${dir}: ${files.length} changed files; rules from ${rulesFrom}; ` +
      `Mulch ${primed ? "primed from " + base : "not primed"}.`,
  );
}
