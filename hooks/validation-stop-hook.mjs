#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readHookMode } from "../lib/hook-mode.mjs";
import { hookBlock } from "../lib/cli/output.mjs";

const workspaceRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const validationFile = process.env.VALIDATION_MD_FILE || "VALIDATION.md";
const pluginRoot =
  process.env.CLAUDE_PLUGIN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (!readHookMode(workspaceRoot).enabled) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [resolve(pluginRoot, "bin/validation-md.mjs"), "hook", "--repo", workspaceRoot, "--file", validationFile],
  { encoding: "utf8", env: process.env, cwd: workspaceRoot },
);

if (result.stdout.trim()) {
  process.stdout.write(result.stdout);
  process.exit(0);
}

if (result.status === 0) {
  process.exit(0);
}

process.stdout.write(
  `${JSON.stringify(
    hookBlock(
      result.error?.message ||
        result.stderr.trim() ||
        `validation-md hook failed with ${result.status ?? "unknown"}.`,
    ),
    null,
    2,
  )}\n`,
);
