# VALIDATION.md

This draft is ready only when every judge below passes.

```validation
goal: Draft sounds human enough to review
judges:
  - id: draft_exists
    exists: draft.md

  - id: draft_avoids_common_ai_phrases
    run: validation-md lint-writing draft.md --max-contrastive 1
```

This is intentionally small. It will not tell you whether the writing is great,
but it can block a few common failure modes before a human spends attention on
the draft.

