# Reference

The complete `VALIDATION.md` format, the CLI, and the files it writes.

## File format

`VALIDATION.md` is ordinary Markdown with one fenced block tagged `validation`.
Everything outside the block is prose for humans. The first `validation` block
is the one that runs.

````markdown
# VALIDATION.md

Prose explaining what done means for this task.

```validation
goal: Work is ready for review
judges:
  - id: tests_pass
    run: npm test
  - id: screenshot_exists
    exists: screenshots/final.png
```
````

The block is YAML with two top-level keys:

| Key      | Required | Meaning                                                    |
| -------- | -------- | ---------------------------------------------------------- |
| `goal`   | no       | One line describing the outcome. Default: `Work is ready for review`. |
| `judges` | yes      | List of judges. All must pass for the decision to be `accepted`. |

## Judges

Each judge is an object with an `id` and exactly one judge kind.

| Field    | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `id`     | Short snake_case name. Shows up in output and in the hook block reason. `name` is accepted as an alias. |
| `run`    | Shell command executed from the repo root. Passes when it exits `0`. |
| `exists` | Path relative to the repo root. Passes when the file or directory exists. |

`run` commands are executed with the platform shell (`/bin/sh` on Unix,
`cmd.exe` on Windows), so pipes, `&&`, and redirects work. stdout and stderr
are captured (first 4000 characters each) into the result file for debugging.

A judge with no recognised kind fails with `Unsupported judge. Use run: or exists:.`
rather than being skipped, so typos cannot silently weaken a file.

### Patterns

```yaml
# a file must differ from main
- id: changelog_updated
  run: git diff --quiet origin/main -- CHANGELOG.md && exit 1 || exit 0

# a document has a section
- id: has_summary
  run: grep -q '^## Summary' report.md

# a threshold
- id: enough_citations
  run: test "$(grep -c http report.md)" -ge 5

# delegate to another agent or script
- id: code_review
  run: ./scripts/review-agent.sh
```

## CLI

```text
validation-md <command> [options]
```

| Command                       | Purpose                                              | Exit code |
| ----------------------------- | ---------------------------------------------------- | --------- |
| `run` (alias `validate`)      | Evaluate every judge, print the report               | `0` accepted, `1` blocked, `2` error |
| `lint-writing <file>` (alias `not-ai`) | Flag common AI-writing tells in a draft     | `0` accepted, `1` blocked, `2` error |
| `doctor`                      | Show which file would run and whether hook mode is on | `0` file found, `1` missing |
| `hook-mode [on\|off\|status]` | Toggle or inspect opt-in Stop-hook enforcement       | `0` |
| `hook`                        | Entry point used by the Claude Code Stop hook        | always `0`; blocks via JSON on stdout |
| `help`                        | Print usage                                          | `0` |

Options:

| Option                  | Applies to                    | Default          |
| ----------------------- | ----------------------------- | ---------------- |
| `--repo <path>`         | all                           | current directory |
| `--file <path>`         | `run`, `hook`, `doctor`       | `VALIDATION.md`  |
| `--json`                | `run`, `lint-writing`, `doctor`, `hook-mode` | off |
| `--max-contrastive <n>` | `lint-writing`                | `1`              |

### `run` output

Text:

```text
Validation.md: blocked
Work is ready for review
- PASS tests_pass: npm test exited 0.
- FAIL screenshot_exists: screenshots/final.png is missing.
```

JSON (`--json`) is the same object that is written to `.validation-md/last-result.json`:

```json
{
  "decision": "blocked",
  "goal": "Work is ready for review",
  "file": "/abs/path/VALIDATION.md",
  "judges": [{ "id": "tests_pass", "type": "run", "status": "passed", "reason": "...", "exit_code": 0, "stdout": "...", "stderr": "..." }],
  "failed": [{ "id": "screenshot_exists", "type": "exists", "status": "failed", "reason": "...", "path": "screenshots/final.png" }],
  "checked_at": "2026-01-01T00:00:00.000Z"
}
```

## State directory

`validation-md` writes to `.validation-md/` in the repo root. Add it to
`.gitignore`.

| File               | Written by             | Contents                                   |
| ------------------ | ---------------------- | ------------------------------------------ |
| `last-result.json` | `run`, `hook`          | Full result of the most recent evaluation  |
| `hook-mode`        | `hook-mode on\|off`    | `on` or `off`                              |

## Hook mode

Hook mode is off unless one of these is true:

- `.validation-md/hook-mode` contains `on`, `enabled`, `1`, or `true`;
- the environment variable `VALIDATION_MD_HOOK_MODE=1` is set.

When on, the Claude Code Stop hook (`hooks/validation-stop-hook.mjs`) runs
`validation-md hook`. If validation is blocked, the hook prints

```json
{ "decision": "block", "reason": "Validation.md blocked completion.\n- <id>: <reason>\n\nContinue working until /validation run accepts." }
```

and Claude Code keeps the session open. Errors while evaluating (missing file,
bad YAML) are also reported as a `block` so a broken gate never passes silently.

Environment variables read by the hook:

| Variable              | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `CLAUDE_PROJECT_DIR`  | Repo root. Default: current directory.     |
| `CLAUDE_PLUGIN_ROOT`  | Where the plugin (and its `bin/`) lives.   |
| `VALIDATION_MD_FILE`  | Validation file. Default: `VALIDATION.md`. |
| `VALIDATION_MD_HOOK_MODE` | `1` forces hook mode on.               |
