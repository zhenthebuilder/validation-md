# VALIDATION.md

A dependency upgrade is done when the lockfile is consistent, nothing is left
vulnerable, the suite still passes, and the change is written down.

```validation
goal: Dependency upgrade is safe to merge
judges:
  - id: lockfile_in_sync
    run: npm ci --ignore-scripts

  - id: no_known_vulnerabilities
    run: npm audit --audit-level=high

  - id: tests_pass
    run: npm test

  - id: changelog_updated
    run: git diff --quiet origin/main -- CHANGELOG.md && exit 1 || exit 0
```

The last judge inverts `git diff --quiet`: it passes only when `CHANGELOG.md`
differs from `main`. Any shell one-liner that exits non-zero on failure works as
a judge.
