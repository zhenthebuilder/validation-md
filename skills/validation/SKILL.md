---
name: validation
description: Define and run repo-local VALIDATION.md checks. Default is /validation run; hook mode is opt-in.
argument-hint: [run|create|doctor|hook on|hook off|hook status|task]
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Validation.md

Use this skill when the user types `/validation ...` or asks for a definition of
done, proof of done, task validation, or agent completion checks.

## CLI Resolution

Use the bundled CLI when the host exposes a plugin root. Fall back to the public
package when the repo is being used as a normal command-line tool.
Define this in the same shell before running the command snippets below.

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-${CODEX_PLUGIN_ROOT:-}}"
if [ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/bin/validation-md.mjs" ]; then
  VALIDATION_MD="node $PLUGIN_ROOT/bin/validation-md.mjs"
else
  VALIDATION_MD="npx -y --package github:zhenthebuilder/validation-md validation-md"
fi
```

## `/validation run`

Run the current validation once:

```bash
$VALIDATION_MD run --file VALIDATION.md
```

If it fails, continue working from the failed judge. Do not weaken
`VALIDATION.md` unless the judge is objectively wrong.

## `/validation create ...`

Create or update `VALIDATION.md` before implementation. Keep it short and
concrete:

````markdown
# Validation.md

This task is done only when every judge below passes.

```validation
goal: Work is ready for review
judges:
  - id: local_tests_pass
    run: npm test

  - id: screenshot_exists
    exists: screenshots/final.png
```
````

Prefer `run` and `exists` judges. Ask for a concrete artifact or command when the
requested rule is vague.

Optional judge fields (all backward-compatible): `tier: gate|audit` (the Stop hook runs
gate-only; tag slow/LLM judges `audit` and run them via `run --full`), `egress: external`
(skipped by `run --no-egress`), `depends_on: [ids]` (skip-not-fail until prereqs pass), and
on `exists`: `non_empty` / `min_bytes` / `matches`. See the project README "Judge reference".

For writing tasks, a useful first judge can be:

```yaml
  - id: draft_avoids_common_ai_phrases
    run: validation-md lint-writing draft.md --max-contrastive 1
```

## `/validation doctor`

Inspect the setup:

```bash
$VALIDATION_MD doctor --file VALIDATION.md
```

## `/validation hook on`

Enable optional Stop-hook enforcement in Claude Code:

```bash
$VALIDATION_MD hook-mode on
```

Codex does not have this Stop-hook integration yet. In Codex, run
`/validation run` explicitly instead.

## `/validation hook off`

Disable Stop-hook enforcement:

```bash
$VALIDATION_MD hook-mode off
```

## `/validation hook status`

Check whether hard stop-gate mode is enabled:

```bash
$VALIDATION_MD hook-mode status
```

## Principle

Validation attaches to work, not every message. Normal brainstorming should not
be interrupted by a hook. Use `/validation run` by default and turn hook mode on
only when the task needs a hard gate.
