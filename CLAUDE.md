# Validation.md

Use `VALIDATION.md` as the repo-local definition of done for non-trivial agent
work.

## Rules

- Do not claim completion until `/validation run` or `validation-md run` accepts.
- Prefer concrete judges: commands that pass, artifacts that exist.
- If validation fails, fix the work. Do not weaken `VALIDATION.md` unless the
  judge is objectively wrong.
- Use hook mode only when the user wants hard stop-gate enforcement.

## Default Flow

1. Write or update `VALIDATION.md` before implementation.
2. Do the work.
3. Run `/validation run`.
4. If blocked, continue from the failed judge.
5. Final answer reports what changed and what validation passed.
