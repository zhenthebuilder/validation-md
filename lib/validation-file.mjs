import { existsSync, readFileSync } from "node:fs";
import YAML from "yaml";
import { validationPath } from "./paths.mjs";

export const DEFAULT_GOAL = "Work is ready for review";

const VALIDATION_BLOCK = /```validation\s*\n([\s\S]*?)\n```/;

export function extractValidationBlock(markdown, file = "VALIDATION.md") {
  const match = markdown.match(VALIDATION_BLOCK);
  if (!match) {
    throw new Error(`${file} does not contain a validation fenced block.`);
  }
  return match[1];
}

export function parseValidation(markdown, file = "VALIDATION.md") {
  const data = YAML.parse(extractValidationBlock(markdown, file));
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("validation block must be a YAML object.");
  }
  if (!Array.isArray(data.judges)) {
    throw new Error("validation block must include judges: [...]");
  }
  return {
    goal: data.goal || DEFAULT_GOAL,
    judges: data.judges,
  };
}

export function loadValidation(args) {
  const file = validationPath(args);
  if (!existsSync(file)) {
    throw new Error(`${args.file} not found.`);
  }
  return { file, ...parseValidation(readFileSync(file, "utf8"), args.file) };
}
