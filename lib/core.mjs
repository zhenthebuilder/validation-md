import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import YAML from "yaml";

export const DEFAULT_FILE = "VALIDATION.md";

export function validationPath(args) {
  return resolve(args.repo, args.file);
}

export function resultPath(repo) {
  return resolve(repo, ".validation-md", "last-result.json");
}

export function modePath(repo) {
  return resolve(repo, ".validation-md", "hook-mode");
}

export function readHookMode(repo) {
  if (process.env.VALIDATION_MD_HOOK_MODE === "1") {
    return { enabled: true, source: "env" };
  }
  const path = modePath(repo);
  if (!existsSync(path)) return { enabled: false, source: "missing", path };
  const text = readFileSync(path, "utf8").trim().toLowerCase();
  return {
    enabled: text === "on" || text === "enabled" || text === "1" || text === "true",
    source: "file",
    path,
  };
}

function extractValidationBlock(markdown, file) {
  const match = markdown.match(/```validation\s*\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`${file} does not contain a validation fenced block.`);
  }
  return match[1];
}

export function loadValidation(args) {
  const file = validationPath(args);
  if (!existsSync(file)) {
    throw new Error(`${args.file} not found.`);
  }
  const markdown = readFileSync(file, "utf8");
  const data = YAML.parse(extractValidationBlock(markdown, args.file));
  if (!data || typeof data !== "object") {
    throw new Error("validation block must be a YAML object.");
  }
  if (!Array.isArray(data.judges)) {
    throw new Error("validation block must include judges: [...]");
  }
  return {
    file,
    goal: data.goal || "Work is ready for review",
    judges: data.judges,
  };
}

function writeResult(repo, payload) {
  const path = resultPath(repo);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

function runCommand(command, repo) {
  const result = spawnSync(command, {
    cwd: repo,
    shell: true,
    encoding: "utf8",
  });
  return {
    ok: result.status === 0,
    exit_code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || null,
  };
}

// Judge metadata that controls selection (not pass/fail). All optional and
// backward-compatible: an untagged judge defaults to tier "gate" so existing
// files run identically (incl. in hook mode).
function judgeMeta(judge) {
  const id = (judge && (judge.id || judge.name)) || "unnamed_judge";
  const tier = judge && judge.tier === "audit" ? "audit" : "gate";
  const egress = judge && judge.egress === "external" ? "external" : "local";
  const dependsOn = !judge
    ? []
    : Array.isArray(judge.depends_on)
      ? judge.depends_on
      : judge.depends_on
        ? [judge.depends_on]
        : [];
  return { id, tier, egress, dependsOn };
}

// `exists:` with optional stronger checks so empty/stub files don't pass.
function evaluateExists(judge, repo) {
  const path = resolve(repo, judge.exists);
  if (!existsSync(path)) {
    return { ok: false, reason: `${judge.exists} is missing.` };
  }
  const needsContent =
    judge.non_empty || judge.min_bytes != null || judge.matches != null;
  if (needsContent) {
    let content;
    try {
      content = readFileSync(path, "utf8");
    } catch (error) {
      return { ok: false, reason: `${judge.exists} is unreadable: ${error.message}` };
    }
    const bytes = Buffer.byteLength(content);
    if (judge.non_empty && content.trim().length === 0) {
      return { ok: false, reason: `${judge.exists} exists but is empty.` };
    }
    if (judge.min_bytes != null && bytes < Number(judge.min_bytes)) {
      return { ok: false, reason: `${judge.exists} is ${bytes}B (< min_bytes ${judge.min_bytes}).` };
    }
    if (judge.matches != null) {
      let regex;
      try {
        regex = new RegExp(judge.matches);
      } catch (error) {
        return { ok: false, reason: `invalid matches regex: ${error.message}` };
      }
      if (!regex.test(content)) {
        return { ok: false, reason: `${judge.exists} does not match /${judge.matches}/.` };
      }
    }
  }
  return { ok: true, reason: `${judge.exists} exists.` };
}

function judgeOne(judge, repo) {
  if (!judge || typeof judge !== "object") {
    return {
      id: "invalid_judge",
      type: "invalid",
      status: "failed",
      reason: "Judge must be an object.",
    };
  }
  const id = judge.id || judge.name || "unnamed_judge";
  if (judge.run) {
    const result = runCommand(judge.run, repo);
    return {
      id,
      type: "run",
      status: result.ok ? "passed" : "failed",
      reason: result.ok ? `${judge.run} exited 0.` : `${judge.run} failed with exit ${result.exit_code ?? "unknown"}.`,
      command: judge.run,
      exit_code: result.exit_code,
      stdout: result.stdout.slice(0, 4000),
      stderr: result.stderr.slice(0, 4000),
      error: result.error,
    };
  }
  if (judge.exists) {
    const check = evaluateExists(judge, repo);
    return {
      id,
      type: "exists",
      status: check.ok ? "passed" : "failed",
      reason: check.reason,
      path: judge.exists,
    };
  }
  return {
    id,
    type: "unknown",
    status: "failed",
    reason: "Unsupported judge. Use run: or exists:.",
  };
}

function toIdSet(value) {
  if (!value) return null;
  const list = Array.isArray(value) ? value : [value];
  return list.length ? new Set(list) : null;
}

// Options (all optional, backward-compatible):
//   gateOnly  — only run tier:"gate" judges (hook mode uses this); audit judges are skipped
//   only/skip — run/exclude specific judge ids
//   noEgress  — skip judges flagged egress:"external" (e.g. judges that send data to a 3rd party)
//   dryRun    — list what would run without executing
// Skipped/planned judges never block; only "failed" blocks.
export function executeValidation(args) {
  const validation = loadValidation(args);
  const only = toIdSet(args.only);
  const skip = toIdSet(args.skip);
  const statusById = new Map();
  const judges = [];

  for (const judge of validation.judges) {
    const meta = judgeMeta(judge);
    const type = judge && judge.run ? "run" : judge && judge.exists ? "exists" : "unknown";

    let skipReason = null;
    if (only && !only.has(meta.id)) skipReason = "not selected (--only)";
    else if (skip && skip.has(meta.id)) skipReason = "skipped (--skip)";
    else if (args.gateOnly && meta.tier !== "gate") skipReason = "audit-tier judge skipped in gate run";
    else if (args.noEgress && meta.egress === "external") skipReason = "skipped (--no-egress)";
    else if (!args.dryRun && meta.dependsOn.some((dep) => statusById.get(dep) !== "passed")) {
      const unmet = meta.dependsOn.filter((dep) => statusById.get(dep) !== "passed");
      skipReason = `dependency not passed: ${unmet.join(", ")}`;
    }

    let result;
    if (skipReason) {
      result = { id: meta.id, type, status: "skipped", reason: skipReason };
    } else if (args.dryRun) {
      result = { id: meta.id, type, status: "planned", reason: "would run (--dry-run)" };
    } else {
      result = judgeOne(judge, args.repo);
    }
    result.tier = meta.tier;
    if (meta.egress === "external") result.egress = "external";
    statusById.set(meta.id, result.status);
    judges.push(result);
  }

  const failed = judges.filter((judge) => judge.status === "failed");
  const skipped = judges.filter((judge) => judge.status === "skipped");
  const decision = args.dryRun ? "dry-run" : failed.length === 0 ? "accepted" : "blocked";
  const payload = {
    decision,
    goal: validation.goal,
    file: validation.file,
    judges,
    failed,
    skipped,
    checked_at: new Date().toISOString(),
  };
  writeResult(args.repo, payload);
  return payload;
}

