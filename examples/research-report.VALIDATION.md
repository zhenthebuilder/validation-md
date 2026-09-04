# VALIDATION.md

A research report is done when the deliverable exists, cites its sources, and
reads like a person wrote it.

```validation
goal: Research report is ready for a human read
judges:
  - id: report_exists
    exists: report.md

  - id: sources_listed
    exists: sources.md

  - id: report_has_a_summary_section
    run: grep -q '^## Summary' report.md

  - id: every_claim_links_a_source
    run: test "$(grep -c 'http' report.md)" -ge 5

  - id: report_avoids_common_ai_phrases
    run: validation-md lint-writing report.md --max-contrastive 1
```

Judges can be crude and still useful. "At least five links" will not catch a
weak argument, but it will catch a report that forgot to cite anything.
