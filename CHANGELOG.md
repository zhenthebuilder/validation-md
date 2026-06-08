# Changelog

## 0.2.0 — cost-aware judging

Backward-compatible (an untagged judge defaults to `tier: gate`, so existing
`VALIDATION.md` files behave identically).

### Added
- **Judge tiering** — `tier: gate | audit`. The Stop hook now runs **gate judges only**
  so it stays fast; expensive `audit` judges (e.g. LLM reviewers) run on demand via
  `validation run --full` (or `VALIDATION_MD_HOOK_FULL=1`).
- **Stronger `exists:`** — optional `non_empty`, `min_bytes`, and `matches` (regex over
  contents) so empty/stub files don't pass.
- **`egress: external`** flag + `validation run --no-egress` — gate judges that send data
  to a third party (useful for privacy-sensitive runs).
- **`depends_on: [ids]`** — a dependent judge is **skipped, not failed**, until its
  prerequisites pass (no wasted runs before an artifact exists).
- **Run selection** — `validation run --only <ids>`, `--skip <ids>`, `--gate`, `--full`,
  `--dry-run`.
- Result/output now distinguishes `skipped` and `planned` judges (SKIP/PLAN) with a
  summary line; `skipped[]` added to `.validation-md/last-result.json`.

### Notes
- The Stop hook running gate-only removes the need to hand-maintain a separate
  "fast" validation file — tag slow judges `tier: audit` in the canonical file instead.

## 0.1.0
- Initial release: `run:` / `exists:` judges, `validation run`, opt-in Stop-hook mode,
  writing lint, `last-result.json`.
