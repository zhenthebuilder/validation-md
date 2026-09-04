# Contributing

Thanks for helping make "done" checkable.

## Setup

Node 18 or newer, no other dependencies.

```bash
git clone https://github.com/zhenthebuilder/validation-md
cd validation-md
npm ci
npm run check
```

`npm run check` runs a syntax check on every `.mjs` file and the `node --test`
suite. It is the same command CI runs.

## Layout

| Path                  | What lives there                                        |
| --------------------- | ------------------------------------------------------- |
| `bin/validation-md.mjs` | CLI entry point                                       |
| `lib/core.mjs`        | Loading `VALIDATION.md`, evaluating judges, hook mode   |
| `lib/writing-lint.mjs` | `lint-writing` rules                                   |
| `hooks/`              | Claude Code Stop hook and its manifest                  |
| `skills/validation/`  | The `/validation` skill used by Claude Code and Codex   |
| `.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/` | Plugin manifests      |
| `examples/`           | Example `VALIDATION.md` files                           |
| `docs/`               | Reference documentation and assets                      |
| `test/`               | `node --test` suites                                    |

## Making a change

1. Open an issue or a draft PR first for anything that changes the file format
   or CLI surface. Small fixes can go straight to a PR.
2. Add or update a test in `test/`. New judge kinds, CLI flags, and lint rules
   all need coverage.
3. Update the docs that describe what you changed: `README.md` for the pitch,
   `docs/reference.md` for exact behavior, `skills/validation/SKILL.md` if the
   `/validation` skill should use it, `examples/` if it is worth showing.
4. Run the repo's own gate before asking for review:

   ```bash
   node bin/validation-md.mjs run
   ```

   The PR template asks you to paste this output.

## Style

- Plain ESM, no build step, no runtime dependencies beyond `yaml`.
- Prefer small functions and explicit names over comments.
- Error messages should tell the user what to do next.
- Keep the CLI output stable: agents parse it. Add fields to JSON output rather
  than changing existing ones.

## Writing

Run drafts of docs through the tool:

```bash
node bin/validation-md.mjs lint-writing README.md
```

## Releases

Bump `version` in `package.json`, `.claude-plugin/plugin.json`, and
`.codex-plugin/plugin.json` together, then tag.
