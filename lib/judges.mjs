import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_LIMIT = 4000;

function runCommand(command, repo) {
  const result = spawnSync(command, { cwd: repo, shell: true, encoding: "utf8" });
  return {
    ok: result.status === 0,
    exit_code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error?.message || null,
  };
}

const runJudge = {
  type: "run",
  key: "run",
  evaluate(judge, repo) {
    const result = runCommand(judge.run, repo);
    return {
      status: result.ok ? "passed" : "failed",
      reason: result.ok
        ? `${judge.run} exited 0.`
        : `${judge.run} failed with exit ${result.exit_code ?? "unknown"}.`,
      command: judge.run,
      exit_code: result.exit_code,
      stdout: result.stdout.slice(0, OUTPUT_LIMIT),
      stderr: result.stderr.slice(0, OUTPUT_LIMIT),
      error: result.error,
    };
  },
};

const existsJudge = {
  type: "exists",
  key: "exists",
  evaluate(judge, repo) {
    const ok = existsSync(resolve(repo, judge.exists));
    return {
      status: ok ? "passed" : "failed",
      reason: ok ? `${judge.exists} exists.` : `${judge.exists} is missing.`,
      path: judge.exists,
    };
  },
};

export const JUDGE_TYPES = [runJudge, existsJudge];

export function judgeTypeFor(judge) {
  return JUDGE_TYPES.find((type) => judge[type.key] !== undefined && judge[type.key] !== null) ?? null;
}

export function judgeId(judge, index) {
  return judge.id || judge.name || `judge_${index + 1}`;
}

export function evaluateJudge(judge, repo, index = 0) {
  if (!judge || typeof judge !== "object" || Array.isArray(judge)) {
    return {
      id: `judge_${index + 1}`,
      type: "invalid",
      status: "failed",
      reason: "Judge must be an object.",
    };
  }
  const id = judgeId(judge, index);
  const type = judgeTypeFor(judge);
  if (!type) {
    const supported = JUDGE_TYPES.map((entry) => `${entry.key}:`).join(" or ");
    return {
      id,
      type: "unknown",
      status: "failed",
      reason: `Unsupported judge. Use ${supported}.`,
    };
  }
  if (typeof judge[type.key] !== "string" || judge[type.key].trim() === "") {
    return {
      id,
      type: type.type,
      status: "failed",
      reason: `${type.key}: must be a non-empty string.`,
    };
  }
  return { id, type: type.type, ...type.evaluate(judge, repo) };
}

export function evaluateJudges(judges, repo) {
  return judges.map((judge, index) => evaluateJudge(judge, repo, index));
}
