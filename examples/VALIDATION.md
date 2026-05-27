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
