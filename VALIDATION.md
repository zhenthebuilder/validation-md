# Validation.md

This repo is ready to publish only when every judge below passes.

```validation
goal: validation-md is ready to publish
judges:
  - id: cli_and_hook_parse
    run: npm run check

  - id: plugin_manifest_exists
    exists: .claude-plugin/plugin.json

  - id: codex_plugin_manifest_exists
    exists: .codex-plugin/plugin.json

  - id: codex_marketplace_manifest_exists
    exists: .agents/plugins/marketplace.json

  - id: validation_skill_exists
    exists: skills/validation/SKILL.md

  - id: validation_engine_exists
    exists: lib/core.mjs

  - id: writing_lint_exists
    exists: lib/writing-lint.mjs

  - id: tests_exist
    exists: test/validation-md.test.mjs

  - id: examples_documented
    exists: examples/README.md

  - id: diagram_exists
    exists: docs/assets/every-agent-needs-a-judge.svg

  - id: not_ai_writing_example_exists
    exists: examples/not-ai-writing.VALIDATION.md
```
