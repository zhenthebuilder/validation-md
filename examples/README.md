# Examples

These examples show the shape of a `VALIDATION.md` file. Copy the closest one
into a repo root, edit the judges, then run:

```bash
validation-md run
```

Every file here is parsed by the test suite, so they stay valid as the format
evolves.

## Files

- [`VALIDATION.md`](VALIDATION.md): basic coding-task validation.
- [`ui-change.VALIDATION.md`](ui-change.VALIDATION.md): typecheck, tests, build,
  and before/after screenshots.
- [`dependency-upgrade.VALIDATION.md`](dependency-upgrade.VALIDATION.md):
  lockfile consistency, audit, tests, and a changelog entry.
- [`research-report.VALIDATION.md`](research-report.VALIDATION.md): deliverable
  and sources exist, structure and citation count, writing lint.
- [`not-ai-writing.VALIDATION.md`](not-ai-writing.VALIDATION.md): a writing
  judge that blocks common generic AI phrasing.

## Patterns

- Put the cheapest judges first; the output reads top to bottom.
- Prefer `exists:` for deliverables and `run:` for anything with a pass/fail
  command.
- Any command that exits non-zero on failure is a judge: `grep -q`, `test`,
  `git diff --quiet`, a reviewer script.
- Keep judge ids short and specific; they show up in the failure report and in
  the agent's next step.
