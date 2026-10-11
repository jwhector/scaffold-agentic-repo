/**
 * Reads the scaffold's settings for the ship-gate scripts.
 *
 * The rules that decide what the gate lets through (data paths, agent branch
 * prefixes, session markers, skipped remotes) are read from the BASE branch's
 * .agentic/config.json, so a branch cannot loosen the gate that judges it.
 * Only on the first install, when the base has no config yet, does the
 * working tree's copy apply.
 *
 * Installed by scaffold-agentic-repo (templates/review-kit).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_PATH = ".agentic/config.json";

export const DEFAULTS = Object.freeze({
  remote: "origin",
  defaultBranch: "main",
  agentBranchPrefixes: ["claude/"],
  dataPaths: ["docs/"],
  skipRemotes: ["no-mistakes"],
  cloudEnvVars: ["CLAUDE_CODE_REMOTE"],
  agentEnvVars: ["CLAUDECODE", "AI_AGENT"],
});

/** Flattens a parsed config file into the settings the scripts use. */
export function settingsFrom(config = {}) {
  const git = config.git ?? {};
  const gate = config.gate ?? {};
  return {
    remote: git.remote ?? DEFAULTS.remote,
    defaultBranch: git.defaultBranch ?? DEFAULTS.defaultBranch,
    agentBranchPrefixes: git.agentBranchPrefixes ?? DEFAULTS.agentBranchPrefixes,
    dataPaths: gate.dataPaths ?? DEFAULTS.dataPaths,
    skipRemotes: gate.skipRemotes ?? DEFAULTS.skipRemotes,
    cloudEnvVars: gate.cloudEnvVars ?? DEFAULTS.cloudEnvVars,
    agentEnvVars: gate.agentEnvVars ?? DEFAULTS.agentEnvVars,
  };
}

/** A marker counts when it is set, non-empty, and not "false" or "0". */
export function anySet(env, vars) {
  return vars.some((name) => {
    const v = (env[name] ?? "").trim().toLowerCase();
    return v !== "" && v !== "false" && v !== "0";
  });
}

export const isCloud = anySet;
/** True in a shell that an agent session opened; a person's own terminal has none of these. */
export const isAgentSession = anySet;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function parse(text, where) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${where}: ${CONFIG_PATH} is not valid JSON (${e.message})`);
  }
}

/** The working tree's config, or {} if there is none. */
export function readWorkingConfig(cwd) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  const path = join(root, CONFIG_PATH);
  return existsSync(path) ? parse(readFileSync(path, "utf8"), "working tree") : {};
}

/** The config at a ref, or undefined if the ref has none. */
export function readConfigAt(cwd, ref) {
  let text;
  try {
    text = git(cwd, ["show", `${ref}:${CONFIG_PATH}`]);
  } catch {
    return undefined;
  }
  return parse(text, ref);
}

/**
 * The base ref to judge against: the remote's HEAD if git knows it, else the
 * configured default branch. Detection comes first so that a branch cannot
 * point the gate at itself by editing defaultBranch.
 */
export function baseRef(cwd, { remote, defaultBranch }) {
  try {
    const head = git(cwd, ["symbolic-ref", "--quiet", `refs/remotes/${remote}/HEAD`]).trim();
    return head.replace(/^refs\/remotes\//, "");
  } catch {
    return `${remote}/${defaultBranch}`;
  }
}

/** Settings for gating: bootstrap from the working tree, then trust the base. */
export function loadGateSettings(cwd, { base } = {}) {
  const boot = settingsFrom(readWorkingConfig(cwd));
  const ref = base ?? baseRef(cwd, boot);
  const atBase = readConfigAt(cwd, ref);
  return { ...settingsFrom(atBase ?? readWorkingConfig(cwd)), base: ref, fromBase: atBase !== undefined };
}
