# VALIDATION.md (tiered)

Cheap **gate** judges run on every Stop-hook check (fast). Expensive **audit** judges
(here, an LLM reviewer) only run on demand via `validation run --full`.

```validation
goal: Work is ready, and the writeup passed an independent review
judges:
  # ── gate: fast + deterministic (the hook runs these) ──
  - id: tests_pass
    run: npm test

  - id: report_exists
    exists: reports/findings.md
    non_empty: true            # a stub file won't pass

  # ── audit: slow / costs tokens / sends data out (hook skips these) ──
  - id: report_reviewed
    tier: audit                # excluded from the Stop hook
    egress: external           # sends the report to a third-party model
    depends_on: [report_exists] # skipped until the report actually exists
    run: ./scripts/llm-review.sh reports/findings.md
```

Run it:

```bash
validation run            # everything (default)
validation run --gate     # only the gate judges (what the hook evaluates)
validation run --full     # everything, incl. audit judges
validation run --dry-run  # plan without executing
```
