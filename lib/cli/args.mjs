import { resolve } from "node:path";

export class UsageError extends Error {}

function requireValue(flag, value) {
  if (value === undefined) throw new UsageError(`${flag} requires a value.`);
  return value;
}

function parseNonNegativeInt(flag, value) {
  const parsed = Number.parseInt(requireValue(flag, value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new UsageError(`${flag} requires a non-negative number.`);
  }
  return parsed;
}

/**
 * Generic argv parser driven by a spec:
 *   options:     { "--repo": { key: "repo", type: "string" | "boolean" | "int" } }
 *   positionals: max number of bare arguments accepted (default 0)
 *   keywords:    { on: { key: "mode", value: "on" } } bare words mapped to values
 *   defaults:    initial values
 */
export function parseArgv(argv, spec) {
  const args = { ...spec.defaults, positionals: [] };
  const maxPositionals = spec.positionals ?? 0;
  const keywords = spec.keywords ?? {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    const option = spec.options[arg];
    if (option) {
      if (option.type === "boolean") {
        args[option.key] = true;
      } else if (option.type === "int") {
        args[option.key] = parseNonNegativeInt(arg, argv[++index]);
      } else {
        args[option.key] = requireValue(arg, argv[++index]);
      }
      continue;
    }
    if (arg in keywords) {
      args[keywords[arg].key] = keywords[arg].value;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new UsageError(`Unknown option: ${arg}`);
    }
    if (args.positionals.length >= maxPositionals) {
      throw new UsageError(`Unexpected argument: ${arg}`);
    }
    args.positionals.push(arg);
  }

  if ("repo" in args) args.repo = resolve(args.repo);
  return args;
}

export const COMMON_OPTIONS = {
  "--repo": { key: "repo", type: "string" },
  "--json": { key: "json", type: "boolean" },
};

export const VALIDATION_OPTIONS = {
  ...COMMON_OPTIONS,
  "--file": { key: "file", type: "string" },
};

export function commonDefaults(cwd = process.cwd()) {
  return { repo: cwd, json: false, help: false };
}
