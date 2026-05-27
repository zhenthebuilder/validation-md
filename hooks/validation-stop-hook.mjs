#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const validationFile = process.env.VALIDATION_MD_FILE || "VALIDATION.md";
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");

function hookResponse(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function hookModeEnabled() {
  if (process.env.VALIDATION_MD_HOOK_MODE === "1") return true;
  const path = resolve(workspaceRoot, ".validation-md", "hook-mode");
  if (!existsSync(path)) return false;
  const mode = readFileSync(path, "utf8").trim().toLowerCase();
  return mode === "on" || mode === "enabled" || mode === "1" || mode === "true";
}

if (!hookModeEnabled()) {
  process.exit(0);
}

const result = spawnSync(process.execPath, [
  resolve(pluginRoot, "bin/validation-md.mjs"),
  "hook",
  "--repo",
  workspaceRoot,
  "--file",
  validationFile,
], {
  encoding: "utf8",
  env: process.env,
  cwd: workspaceRoot,
});

if (result.stdout.trim()) {
  process.stdout.write(result.stdout);
  process.exit(0);
}

if (result.status === 0) {
  process.exit(0);
}

hookResponse({
  decision: "block",
  reason: result.error?.message || result.stderr.trim() || `validation-md hook failed with ${result.status ?? "unknown"}.`,
});
