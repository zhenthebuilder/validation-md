import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { JUDGE_TYPES, evaluateJudge, evaluateJudges, judgeTypeFor } from "../lib/judges.mjs";
import { parseValidation } from "../lib/validation-file.mjs";

function tempRepo() {
  return mkdtempSync(join(tmpdir(), "validation-md-judges-"));
}

test("judge registry exposes run and exists", () => {
  assert.deepEqual(JUDGE_TYPES.map((type) => type.type), ["run", "exists"]);
  assert.equal(judgeTypeFor({ run: "true" }).type, "run");
  assert.equal(judgeTypeFor({ exists: "a" }).type, "exists");
  assert.equal(judgeTypeFor({ glob: "*" }), null);
});

test("run judge captures exit code and output", () => {
  const repo = tempRepo();
  const passed = evaluateJudge({ id: "p", run: 'node -e "console.log(1)"' }, repo);
  assert.equal(passed.status, "passed");
  assert.equal(passed.stdout.trim(), "1");

  const failed = evaluateJudge({ id: "f", run: 'node -e "process.exit(3)"' }, repo);
  assert.equal(failed.status, "failed");
  assert.equal(failed.exit_code, 3);
  assert.match(failed.reason, /exit 3/);
});

test("exists judge resolves relative to repo", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "a.txt"), "");
  assert.equal(evaluateJudge({ id: "a", exists: "a.txt" }, repo).status, "passed");
  assert.equal(evaluateJudge({ id: "b", exists: "b.txt" }, repo).status, "failed");
});

test("malformed judges fail with descriptive reasons and stable ids", () => {
  const repo = tempRepo();
  const results = evaluateJudges(
    ["nope", { id: "x", glob: "*" }, { run: "" }, { name: "named", exists: "a" }],
    repo,
  );
  assert.deepEqual(
    results.map((judge) => [judge.id, judge.type, judge.status]),
    [
      ["judge_1", "invalid", "failed"],
      ["x", "unknown", "failed"],
      ["judge_3", "run", "failed"],
      ["named", "exists", "failed"],
    ],
  );
  assert.match(results[1].reason, /Use run: or exists:/);
  assert.match(results[2].reason, /non-empty string/);
});

test("parseValidation extracts block, defaults goal, and rejects bad shapes", () => {
  const parsed = parseValidation("intro\n\n```validation\njudges:\n  - id: a\n    exists: a\n```\n");
  assert.equal(parsed.goal, "Work is ready for review");
  assert.equal(parsed.judges.length, 1);

  assert.throws(() => parseValidation("no block"), /does not contain a validation fenced block/);
  assert.throws(() => parseValidation("```validation\n- a\n```"), /must be a YAML object/);
  assert.throws(() => parseValidation("```validation\ngoal: x\n```"), /must include judges/);
});
