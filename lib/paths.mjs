import { resolve } from "node:path";

export const DEFAULT_FILE = "VALIDATION.md";
export const STATE_DIR = ".validation-md";

export function validationPath(args) {
  return resolve(args.repo, args.file ?? DEFAULT_FILE);
}

export function stateDir(repo) {
  return resolve(repo, STATE_DIR);
}

export function resultPath(repo) {
  return resolve(stateDir(repo), "last-result.json");
}

export function modePath(repo) {
  return resolve(stateDir(repo), "hook-mode");
}
