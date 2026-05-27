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
    const path = resolve(repo, judge.exists);
    const ok = existsSync(path);
    return {
      id,
      type: "exists",
      status: ok ? "passed" : "failed",
      reason: ok ? `${judge.exists} exists.` : `${judge.exists} is missing.`,
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

export function executeValidation(args) {
  const validation = loadValidation(args);
  const judges = validation.judges.map((judge) => judgeOne(judge, args.repo));
  const failed = judges.filter((judge) => judge.status !== "passed");
  const payload = {
    decision: failed.length === 0 ? "accepted" : "blocked",
    goal: validation.goal,
    file: validation.file,
    judges,
    failed,
    checked_at: new Date().toISOString(),
  };
  writeResult(args.repo, payload);
  return payload;
}

