#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_FILE,
  executeValidation,
  modePath,
  readHookMode,
  validationPath,
} from "../lib/core.mjs";
import { lintWritingText } from "../lib/writing-lint.mjs";

function usage() {
  return [
    "Usage: validation-md <command> [options]",
    "",
    "Commands:",
    "  run              Run VALIDATION.md once",
    "  validate         Alias for run",
    "  lint-writing     Check a draft for common AI-writing tells",
    "  hook             Run as Claude Code Stop hook",
    "  hook-mode        Turn optional Stop-hook enforcement on/off",
    "  doctor           Inspect VALIDATION.md and hook mode",
    "",
    "Options:",
    "  --file <path>    Validation file, default VALIDATION.md",
    "  --repo <path>    Repo root, default current directory",
    "  --json           Print JSON",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    repo: process.cwd(),
    file: DEFAULT_FILE,
    json: false,
    mode: "status",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") {
      args.repo = argv[++index];
      if (!args.repo) throw new Error("--repo requires a path.");
    } else if (arg === "--file") {
      args.file = argv[++index];
      if (!args.file) throw new Error("--file requires a path.");
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "on" || arg === "enable") {
      args.mode = "on";
    } else if (arg === "off" || arg === "disable") {
      args.mode = "off";
    } else if (arg === "status") {
      args.mode = "status";
    }
  }
  args.repo = resolve(args.repo);
  return args;
}

function parseLintWritingArgs(argv) {
  const args = {
    repo: process.cwd(),
    file: null,
    json: false,
    maxContrastive: 1,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") {
      args.repo = argv[++index];
      if (!args.repo) throw new Error("--repo requires a path.");
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--max-contrastive") {
      const value = Number.parseInt(argv[++index], 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--max-contrastive requires a non-negative number.");
      }
      args.maxContrastive = value;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (!args.file) {
      args.file = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  args.repo = resolve(args.repo);
  return args;
}

function printValidation(payload) {
  process.stdout.write(`Validation.md: ${payload.decision}\n`);
  process.stdout.write(`${payload.goal}\n`);
  for (const judge of payload.judges) {
    process.stdout.write(`- ${judge.status === "passed" ? "PASS" : "FAIL"} ${judge.id}: ${judge.reason}\n`);
  }
}

function runValidation(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write("Usage: validation-md run [--repo <path>] [--file VALIDATION.md] [--json]\n");
    return 0;
  }
  const payload = executeValidation(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    printValidation(payload);
  }
  return payload.decision === "accepted" ? 0 : 1;
}

function lintWriting(argv) {
  const args = parseLintWritingArgs(argv);
  if (args.help) {
    process.stdout.write(
      "Usage: validation-md lint-writing <file> [--repo <path>] [--max-contrastive 1] [--json]\n",
    );
    return 0;
  }
  if (!args.file) {
    throw new Error("lint-writing requires a file path.");
  }
  const file = resolve(args.repo, args.file);
  if (!existsSync(file)) {
    throw new Error(`${args.file} not found.`);
  }

  const result = lintWritingText(readFileSync(file, "utf8"), {
    maxContrastive: args.maxContrastive,
  });
  const payload = { ...result, file };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (payload.decision === "accepted") {
    process.stdout.write("Writing lint: accepted\n");
  } else {
    process.stdout.write("Writing lint: blocked\n");
    for (const issue of payload.issues) {
      process.stdout.write(`- ${issue.id}: ${issue.reason}\n`);
      for (const match of issue.matches) {
        process.stdout.write(`  line ${match.line}: ${match.text}\n`);
      }
    }
  }
  return payload.decision === "accepted" ? 0 : 1;
}

function hookMode(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write("Usage: validation-md hook-mode [on|off|status] [--repo <path>] [--json]\n");
    return 0;
  }
  const path = modePath(args.repo);
  if (args.mode === "on" || args.mode === "off") {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${args.mode}\n`);
  }
  const mode = readHookMode(args.repo);
  const payload = {
    enabled: mode.enabled,
    source: mode.source,
    path: mode.path || path,
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Validation.md hook mode: ${mode.enabled ? "on" : "off"}\n`);
  }
  return 0;
}

function hook(argv) {
  const args = parseArgs(argv);
  const mode = readHookMode(args.repo);
  if (!mode.enabled) {
    return 0;
  }
  const payload = executeValidation(args);
  if (payload.decision === "accepted") {
    return 0;
  }
  const failed = payload.failed.map((judge) => `- ${judge.id}: ${judge.reason}`).join("\n");
  process.stdout.write(
    `${JSON.stringify(
      {
        decision: "block",
        reason: `Validation.md blocked completion.\n${failed}\n\nContinue working until /validation run accepts.`,
      },
      null,
      2,
    )}\n`,
  );
  return 0;
}

function doctor(argv) {
  const args = parseArgs(argv);
  const path = validationPath(args);
  const mode = readHookMode(args.repo);
  const payload = {
    repo: args.repo,
    file: path,
    file_exists: existsSync(path),
    hook_mode: mode.enabled,
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write("Validation.md doctor\n");
    process.stdout.write(`- file: ${payload.file_exists ? "found" : "missing"} (${path})\n`);
    process.stdout.write(`- hook mode: ${mode.enabled ? "on" : "off"}\n`);
  }
  return payload.file_exists ? 0 : 1;
}

const [command = "help", ...args] = process.argv.slice(2);
let code = 0;
try {
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
  } else if (command === "run" || command === "validate") {
    code = runValidation(args);
  } else if (command === "lint-writing" || command === "not-ai") {
    code = lintWriting(args);
  } else if (command === "hook-mode") {
    code = hookMode(args);
  } else if (command === "hook") {
    code = hook(args);
  } else if (command === "doctor") {
    code = doctor(args);
  } else {
    process.stderr.write(`Unknown command: ${command}\n\n${usage()}\n`);
    code = 2;
  }
} catch (error) {
  if (command === "hook") {
    process.stdout.write(
      `${JSON.stringify(
        {
          decision: "block",
          reason: `Validation.md hook error: ${error.message}`,
        },
        null,
        2,
      )}\n`,
    );
    code = 0;
  } else {
    process.stderr.write(`Validation.md error: ${error.message}\n`);
    code = 2;
  }
}

process.exitCode = code;
