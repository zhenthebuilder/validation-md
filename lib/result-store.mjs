import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resultPath } from "./paths.mjs";

export function writeResult(repo, payload) {
  const path = resultPath(repo);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return path;
}

export function readResult(repo) {
  const path = resultPath(repo);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}
