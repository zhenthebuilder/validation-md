import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { executeValidation, readHookMode } from "../lib/core.mjs";
import { lintWritingText } from "../lib/writing-lint.mjs";

function tempRepo() {
  return mkdtempSync(join(tmpdir(), "validation-md-"));
}

function writeValidation(repo, body) {
  writeFileSync(
    join(repo, "VALIDATION.md"),
    `# VALIDATION.md

\`\`\`validation
${body}
\`\`\`
`,
  );
}

test("executeValidation accepts passing run and exists judges", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "screenshot.png"), "ok");
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: command_passes
    run: node -e "process.exit(0)"
  - id: artifact_exists
    exists: screenshot.png
`,
  );

  const result = executeValidation({ repo, file: "VALIDATION.md" });

  assert.equal(result.decision, "accepted");
  assert.equal(result.failed.length, 0);
  assert.ok(existsSync(join(repo, ".validation-md", "last-result.json")));
});

test("executeValidation blocks missing artifacts", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: artifact_exists
    exists: missing.png
`,
  );

  const result = executeValidation({ repo, file: "VALIDATION.md" });

  assert.equal(result.decision, "blocked");
  assert.equal(result.failed[0].id, "artifact_exists");
});

test("readHookMode defaults off and reads opt-in mode file", () => {
  const repo = tempRepo();

  assert.equal(readHookMode(repo).enabled, false);

  mkdirSync(join(repo, ".validation-md"));
  writeFileSync(join(repo, ".validation-md", "hook-mode"), "on\n");

  assert.equal(readHookMode(repo).enabled, true);
});

test("lintWritingText blocks generic AI writing tells", () => {
  const result = lintWritingText(
    "This is not just a game changer in today's fast-paced world.",
    { maxContrastive: 0 },
  );

  assert.equal(result.decision, "blocked");
  assert.deepEqual(
    result.issues.map((issue) => issue.id),
    ["too_many_contrastive_reframes", "generic_ai_phrases"],
  );
});

test("lintWritingText accepts plain direct writing", () => {
  const result = lintWritingText("Agents can do the work. The harder part is deciding when it counts.");

  assert.equal(result.decision, "accepted");
  assert.deepEqual(result.issues, []);
});

test("plugin manifests parse as JSON", () => {
  for (const file of [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    ".claude-plugin/plugin.json",
    ".codex-plugin/plugin.json",
    "hooks/hooks.json",
  ]) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(typeof manifest, "object");
  }
});

test("exists honors non_empty", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "stub.md"), "   \n");
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: not_empty
    exists: stub.md
    non_empty: true
`,
  );
  const result = executeValidation({ repo, file: "VALIDATION.md" });
  assert.equal(result.decision, "blocked");
  assert.equal(result.failed[0].id, "not_empty");
});

test("exists honors matches", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "doc.md"), "# Title\nbody\n");
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: has_heading
    exists: doc.md
    matches: "^# "
`,
  );
  assert.equal(executeValidation({ repo, file: "VALIDATION.md" }).decision, "accepted");
});

test("gateOnly skips audit judges and does not block", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: cheap
    run: node -e "process.exit(0)"
  - id: expensive
    tier: audit
    run: node -e "process.exit(1)"
`,
  );
  const gate = executeValidation({ repo, file: "VALIDATION.md", gateOnly: true });
  assert.equal(gate.decision, "accepted");
  assert.equal(gate.skipped.find((judge) => judge.id === "expensive").status, "skipped");

  const full = executeValidation({ repo, file: "VALIDATION.md" });
  assert.equal(full.decision, "blocked");
});

test("only / skip select judges", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: a
    run: node -e "process.exit(1)"
  - id: b
    run: node -e "process.exit(0)"
`,
  );
  assert.equal(executeValidation({ repo, file: "VALIDATION.md", only: ["b"] }).decision, "accepted");
  assert.equal(executeValidation({ repo, file: "VALIDATION.md", skip: ["a"] }).decision, "accepted");
});

test("no-egress skips external judges", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: external_judge
    egress: external
    run: node -e "process.exit(1)"
`,
  );
  assert.equal(executeValidation({ repo, file: "VALIDATION.md", noEgress: true }).decision, "accepted");
});

test("depends_on skips dependents (not fail) when prerequisite fails", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: prereq
    run: node -e "process.exit(1)"
  - id: dependent
    depends_on: [prereq]
    run: node -e "process.exit(0)"
`,
  );
  const result = executeValidation({ repo, file: "VALIDATION.md" });
  assert.equal(result.decision, "blocked");
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].id, "prereq");
  assert.equal(result.judges.find((judge) => judge.id === "dependent").status, "skipped");
});

test("dry-run plans without executing or blocking", () => {
  const repo = tempRepo();
  writeValidation(
    repo,
    `goal: Ready
judges:
  - id: would_fail
    run: node -e "process.exit(1)"
`,
  );
  const result = executeValidation({ repo, file: "VALIDATION.md", dryRun: true });
  assert.equal(result.decision, "dry-run");
  assert.equal(result.judges[0].status, "planned");
  assert.equal(result.failed.length, 0);
});
