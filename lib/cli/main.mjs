import { UsageError } from "./args.mjs";
import { findCommand, usage } from "./commands.mjs";
import { createOutput } from "./output.mjs";

const HELP = new Set(["help", "--help", "-h"]);

export function main(argv, { cwd = process.cwd(), stdout, stderr } = {}) {
  const out = createOutput(stdout, stderr);
  const [name = "help", ...rest] = argv;

  if (HELP.has(name)) {
    out.line(usage());
    return 0;
  }

  const command = findCommand(name);
  if (!command) {
    out.error(`Unknown command: ${name}\n\n${usage()}`);
    return 2;
  }

  try {
    const args = command.parse(rest, cwd);
    if (args.help) {
      out.line(`Usage: ${command.usage}`);
      return 0;
    }
    return command.execute(args, out);
  } catch (error) {
    if (command.onError) return command.onError(error, out);
    out.error(`Validation.md error: ${error.message}`);
    if (error instanceof UsageError) out.error(`Usage: ${command.usage}`);
    return 2;
  }
}
