# VALIDATION.md

A UI change is done when it builds, its tests pass, and there is visual evidence
of the final state.

```validation
goal: UI change is ready for review
judges:
  - id: typecheck_passes
    run: npm run typecheck

  - id: unit_tests_pass
    run: npm test

  - id: production_build_succeeds
    run: npm run build

  - id: before_screenshot_exists
    exists: screenshots/before.png

  - id: after_screenshot_exists
    exists: screenshots/after.png
```

The screenshots are the part an automated test cannot replace: they let a human
confirm the change looks right without checking out the branch.
