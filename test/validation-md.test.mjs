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
