import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_FILE,
  executeValidation,
  readHookMode,
  validationPath,
  writeHookMode,
} from "../core.mjs";
import { lintWritingText } from "../writing-lint.mjs";
import {
  COMMON_OPTIONS,
  UsageError,
  VALIDATION_OPTIONS,
  commonDefaults,
  parseArgv,
} from "./args.mjs";
import { formatFailedJudges, formatValidation, formatWritingLint, hookBlock } from "./output.mjs";

function validationDefaults(cwd) {
  return { ...commonDefaults(cwd), file: DEFAULT_FILE };
}

const run = {
  name: "run",
  aliases: ["validate"],
  summary: "Run VALIDATION.md once",
  usage: "validation-md run [--repo <path>] [--file VALIDATION.md] [--json]",
  parse: (argv, cwd) =>
    parseArgv(argv, { options: VALIDATION_OPTIONS, defaults: validationDefaults(cwd) }),
  execute(args, out) {
    const payload = executeValidation(args);
    if (args.json) out.json(payload);
    else formatValidation(payload).forEach((line) => out.line(line));
    return payload.decision === "accepted" ? 0 : 1;
  },
};

const lintWriting = {
  name: "lint-writing",
  aliases: ["not-ai"],
  summary: "Check a draft for common AI-writing tells",
  usage: "validation-md lint-writing <file> [--repo <path>] [--max-contrastive 1] [--json]",
  parse: (argv, cwd) =>
    parseArgv(argv, {
      options: { ...COMMON_OPTIONS, "--max-contrastive": { key: "maxContrastive", type: "int" } },
      defaults: { ...commonDefaults(cwd), maxContrastive: 1 },
      positionals: 1,
    }),
  execute(args, out) {
    const [file] = args.positionals;
    if (!file) throw new UsageError("lint-writing requires a file path.");
    const path = resolve(args.repo, file);
    if (!existsSync(path)) throw new Error(`${file} not found.`);

    const result = lintWritingText(readFileSync(path, "utf8"), {
      maxContrastive: args.maxContrastive,
    });
    const payload = { ...result, file: path };
    if (args.json) out.json(payload);
    else formatWritingLint(payload).forEach((line) => out.line(line));
    return payload.decision === "accepted" ? 0 : 1;
  },
};

const hookMode = {
  name: "hook-mode",
  aliases: [],
  summary: "Turn optional Stop-hook enforcement on/off",
  usage: "validation-md hook-mode [on|off|status] [--repo <path>] [--json]",
  parse: (argv, cwd) =>
    parseArgv(argv, {
      options: COMMON_OPTIONS,
      defaults: { ...commonDefaults(cwd), mode: "status" },
      keywords: {
        on: { key: "mode", value: "on" },
        enable: { key: "mode", value: "on" },
        off: { key: "mode", value: "off" },
        disable: { key: "mode", value: "off" },
        status: { key: "mode", value: "status" },
      },
    }),
  execute(args, out) {
    if (args.mode !== "status") writeHookMode(args.repo, args.mode === "on");
    const mode = readHookMode(args.repo);
    if (args.json) out.json({ enabled: mode.enabled, source: mode.source, path: mode.path });
    else out.line(`Validation.md hook mode: ${mode.enabled ? "on" : "off"}`);
    return 0;
  },
};

const hook = {
  name: "hook",
  aliases: [],
  summary: "Run as Claude Code Stop hook",
  usage: "validation-md hook [--repo <path>] [--file VALIDATION.md]",
  parse: run.parse,
  execute(args, out) {
    if (!readHookMode(args.repo).enabled) return 0;
    const payload = executeValidation(args);
    if (payload.decision !== "accepted") {
      out.json(
        hookBlock(
          `Validation.md blocked completion.\n${formatFailedJudges(payload.failed)}\n\nContinue working until /validation run accepts.`,
        ),
      );
    }
    return 0;
  },
  onError(error, out) {
    out.json(hookBlock(`Validation.md hook error: ${error.message}`));
    return 0;
  },
};

const doctor = {
  name: "doctor",
  aliases: [],
  summary: "Inspect VALIDATION.md and hook mode",
  usage: "validation-md doctor [--repo <path>] [--file VALIDATION.md] [--json]",
  parse: run.parse,
  execute(args, out) {
    const file = validationPath(args);
    const mode = readHookMode(args.repo);
    const payload = {
      repo: args.repo,
      file,
      file_exists: existsSync(file),
      hook_mode: mode.enabled,
    };
    if (args.json) {
      out.json(payload);
    } else {
      out.line("Validation.md doctor");
      out.line(`- file: ${payload.file_exists ? "found" : "missing"} (${file})`);
      out.line(`- hook mode: ${mode.enabled ? "on" : "off"}`);
    }
    return payload.file_exists ? 0 : 1;
  },
};

export const COMMANDS = [run, lintWriting, hook, hookMode, doctor];

export function findCommand(name) {
  return COMMANDS.find((command) => command.name === name || command.aliases.includes(name)) ?? null;
}

export function usage() {
  const width = Math.max(...COMMANDS.flatMap((c) => [c.name, ...c.aliases]).map((n) => n.length));
  const lines = ["Usage: validation-md <command> [options]", "", "Commands:"];
  for (const command of COMMANDS) {
    lines.push(`  ${command.name.padEnd(width)}    ${command.summary}`);
    for (const alias of command.aliases) {
      lines.push(`  ${alias.padEnd(width)}    Alias for ${command.name}`);
    }
  }
  lines.push(
    "",
    "Options:",
    "  --file <path>    Validation file, default VALIDATION.md",
    "  --repo <path>    Repo root, default current directory",
    "  --json           Print JSON",
  );
  return lines.join("\n");
}
