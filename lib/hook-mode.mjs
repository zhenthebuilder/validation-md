import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { modePath } from "./paths.mjs";

export const HOOK_MODE_ENV = "VALIDATION_MD_HOOK_MODE";

const TRUTHY = new Set(["on", "enabled", "1", "true"]);

export function isTruthyMode(text) {
  return TRUTHY.has(String(text).trim().toLowerCase());
}

export function readHookMode(repo, env = process.env) {
  if (env[HOOK_MODE_ENV] === "1") {
    return { enabled: true, source: "env", path: modePath(repo) };
  }
  const path = modePath(repo);
  if (!existsSync(path)) {
    return { enabled: false, source: "missing", path };
  }
  return {
    enabled: isTruthyMode(readFileSync(path, "utf8")),
    source: "file",
    path,
  };
}

export function writeHookMode(repo, enabled) {
  const path = modePath(repo);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${enabled ? "on" : "off"}\n`);
  return path;
}
