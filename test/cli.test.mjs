import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { COMMON_OPTIONS, UsageError, parseArgv } from "../lib/cli/args.mjs";
import { COMMANDS, findCommand, usage } from "../lib/cli/commands.mjs";
import { main } from "../lib/cli/main.mjs";

const BIN = resolve("bin/validation-md.mjs");

function tempRepo() {
  return mkdtempSync(join(tmpdir(), "validation-md-cli-"));
}

function writeValidation(repo, body) {
  writeFileSync(join(repo, "VALIDATION.md"), `# VALIDATION.md\n\n\`\`\`validation\n${body}\`\`\`\n`);
}

function capture() {
  const chunks = { stdout: "", stderr: "" };
  return {
    chunks,
    stdout: { write: (text) => (chunks.stdout += text) },
    stderr: { write: (text) => (chunks.stderr += text) },
  };
}

function runMain(argv, cwd) {
  const io = capture();
  const code = main(argv, { cwd, stdout: io.stdout, stderr: io.stderr });
  return { code, ...io.chunks };
}

test("parseArgv handles options, keywords, positionals and resolves repo", () => {
  const args = parseArgv(["draft.md", "--json", "--repo", "sub", "on", "--n", "2"], {
    options: { ...COMMON_OPTIONS, "--n": { key: "n", type: "int" } },
    defaults: { repo: process.cwd(), json: false },
    keywords: { on: { key: "mode", value: "on" } },
    positionals: 1,
  });

  assert.equal(args.json, true);
  assert.equal(args.repo, resolve("sub"));
  assert.equal(args.mode, "on");
  assert.equal(args.n, 2);
  assert.deepEqual(args.positionals, ["draft.md"]);
});

test("parseArgv rejects unknown options, extra positionals and bad values", () => {
  const spec = { options: COMMON_OPTIONS, defaults: { repo: "." } };
  assert.throws(() => parseArgv(["--nope"], spec), UsageError);
  assert.throws(() => parseArgv(["extra"], spec), UsageError);
  assert.throws(() => parseArgv(["--repo"], spec), UsageError);
  assert.throws(
    () => parseArgv(["--n", "-1"], { options: { "--n": { key: "n", type: "int" } }, defaults: {} }),
    UsageError,
  );
});

test("command registry resolves names and aliases and lists them in usage", () => {
  assert.equal(findCommand("validate"), findCommand("run"));
  assert.equal(findCommand("not-ai"), findCommand("lint-writing"));
  assert.equal(findCommand("missing"), null);
  for (const command of COMMANDS) {
    assert.match(usage(), new RegExp(`\\b${command.name}\\b`));
  }
});

test("main: help, unknown command, per-command help", () => {
  assert.equal(runMain([]).code, 0);
  assert.match(runMain(["help"]).stdout, /Usage: validation-md <command>/);

  const unknown = runMain(["bogus"]);
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /Unknown command: bogus/);

  const help = runMain(["run", "--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Usage: validation-md run/);
});

test("main: run prints text and json and sets exit code", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "ok.txt"), "");
  writeValidation(repo, "goal: G\njudges:\n  - id: a\n    exists: ok.txt\n  - id: b\n    exists: nope.txt\n");

  const text = runMain(["run", "--repo", repo]);
  assert.equal(text.code, 1);
  assert.match(text.stdout, /^Validation.md: blocked\nG\n- PASS a: ok.txt exists.\n- FAIL b: nope.txt is missing.\n$/);

  const json = JSON.parse(runMain(["run", "--repo", repo, "--json"]).stdout);
  assert.equal(json.decision, "blocked");
  assert.equal(json.failed.length, 1);
});

test("main: usage errors report the command usage", () => {
  const result = runMain(["run", "--bogus"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Unknown option: --bogus/);
  assert.match(result.stderr, /Usage: validation-md run/);
});

test("main: hook-mode toggles and hook blocks only when enabled", () => {
  const repo = tempRepo();
  writeValidation(repo, "judges:\n  - id: a\n    exists: missing\n");

  assert.equal(runMain(["hook", "--repo", repo]).stdout, "");

  assert.match(runMain(["hook-mode", "on", "--repo", repo]).stdout, /hook mode: on/);
  const blocked = JSON.parse(runMain(["hook", "--repo", repo]).stdout);
  assert.equal(blocked.decision, "block");
  assert.match(blocked.reason, /- a: missing is missing\./);

  assert.match(runMain(["hook-mode", "off", "--repo", repo]).stdout, /hook mode: off/);
  const status = JSON.parse(runMain(["hook-mode", "status", "--repo", repo, "--json"]).stdout);
  assert.deepEqual(status, { enabled: false, source: "file", path: join(repo, ".validation-md", "hook-mode") });
});

test("main: hook reports errors as block decisions with exit 0", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, ".validation-md"), "");
  const result = runMain(["hook", "--repo", repo]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");

  const enabled = tempRepo();
  process.env.VALIDATION_MD_HOOK_MODE = "1";
  try {
    const out = runMain(["hook", "--repo", enabled]);
    assert.equal(out.code, 0);
    assert.match(JSON.parse(out.stdout).reason, /VALIDATION.md not found/);
  } finally {
    delete process.env.VALIDATION_MD_HOOK_MODE;
  }
});

test("main: doctor and lint-writing", () => {
  const repo = tempRepo();
  assert.equal(runMain(["doctor", "--repo", repo]).code, 1);
  writeValidation(repo, "judges: []\n");
  const doctor = runMain(["doctor", "--repo", repo, "--json"]);
  assert.equal(doctor.code, 0);
  assert.equal(JSON.parse(doctor.stdout).file_exists, true);

  writeFileSync(join(repo, "draft.md"), "We delve into it.\n");
  const lint = runMain(["lint-writing", "draft.md", "--repo", repo]);
  assert.equal(lint.code, 1);
  assert.match(lint.stdout, /generic_ai_phrases[\s\S]*line 1: delve into/);
  assert.equal(runMain(["lint-writing", "--repo", repo]).code, 2);
});

test("bin entrypoint runs end to end", () => {
  const repo = tempRepo();
  writeValidation(repo, "judges:\n  - id: ok\n    run: node -e \"process.exit(0)\"\n");
  const result = spawnSync(process.execPath, [BIN, "run", "--repo", repo], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validation.md: accepted/);
});
