import { evaluateJudges } from "./judges.mjs";
import { writeResult } from "./result-store.mjs";
import { loadValidation } from "./validation-file.mjs";

export { DEFAULT_FILE, modePath, resultPath, validationPath } from "./paths.mjs";
export { readHookMode, writeHookMode } from "./hook-mode.mjs";
export { loadValidation, parseValidation } from "./validation-file.mjs";
export { evaluateJudge, evaluateJudges, JUDGE_TYPES } from "./judges.mjs";
export { readResult, writeResult } from "./result-store.mjs";

export function executeValidation(args) {
  const validation = loadValidation(args);
  const judges = evaluateJudges(validation.judges, args.repo);
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
