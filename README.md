# validation-md

Make "done" checkable.

Agents can do a lot of work now. The weak point is acceptance: the agent says the
task is done before the evidence is strong enough. `VALIDATION.md` is a small
repo-local definition of done that humans and agents can both read.

![Every Agent Needs a Judge](docs/assets/every-agent-needs-a-judge.svg)

Default behavior is manual:

```text
/validation run
```

Hook mode exists, but it is opt-in. Normal discussion should not be interrupted
by a validation gate.

## Quick Start

Create `VALIDATION.md` in the repo root:

````markdown
# VALIDATION.md

This task is done only when every judge below passes.

```validation
goal: Work is ready for review
judges:
  - id: local_tests_pass
    run: npm test

  - id: screenshot_exists
    exists: screenshots/final.png
```
````

Run it:

```bash
npx -y --package github:zhenthebuilder/validation-md validation-md run
```

If a judge fails, the task is not done yet. The failed judge becomes the next
thing for the agent to fix.

## Agent Support

This repo can be used from both Claude Code and Codex.

### Claude Code

Install from the repo:

```text
/plugin marketplace add zhenthebuilder/validation-md
/plugin install validation-md@validation-md
```

Use it explicitly:

```text
/validation create require tests and a final screenshot
/validation run
```

Hard-stop mode is optional. Turn it on only for tasks where the agent should be
blocked from claiming done until validation passes:

```text
/validation hook on
/validation hook off
/validation hook status
```

### Codex

Point Codex at this repo as a plugin and use:

```text
/validation run
```

Codex hook enforcement is not implemented here yet. For Codex, use explicit
validation runs.

## Why a File?

Permanent checks are usually written when the repo is set up. `VALIDATION.md` is
written when the task is scoped.

A UI change, a dependency upgrade, and a research report can each have a
different definition of done without rewriting permanent automation. The handoff
is the point:

- the agent can draft the validation file;
- the human can edit it;
- a command, plugin skill, hook, or automated check can enforce it.

If the acceptance criteria live in a file, they travel with the work instead of
getting buried in chat.

## Examples

Run commands:

```yaml
judges:
  - id: tests_pass
    run: npm test
```

Require artifacts:

```yaml
judges:
  - id: screenshot_exists
    exists: screenshots/final.png
```

Use validation for writing too:

```yaml
judges:
  - id: draft_has_human_voice
    run: validation-md lint-writing draft.md --max-contrastive 1
```

Use a separate reviewer agent behind a command:

```yaml
judges:
  - id: code_review
    run: ./scripts/review-agent.sh
```

The protocol should eventually make reviewer agents, code reviewers, and other
semantic judges easier to define directly. For now, any reviewer that can return
a process exit code can be used as a `run` judge.

See [`examples/`](examples/) for complete files.

## Judge reference

Every judge has an `id` and one check — `run:` (passes on exit 0) or `exists:` (a file path).
The following fields are optional and backward-compatible:

```yaml
judges:
  # exists: with stronger checks so empty/stub files don't pass
  - id: report
    exists: reports/findings.md
    non_empty: true            # must have non-whitespace content
    min_bytes: 200             # must be at least N bytes
    matches: "^# "             # content must match this regex

  # tiering: the Stop hook runs ONLY tier:gate judges (fast); tier:audit
  # judges (e.g. slow LLM reviewers) are skipped in the hook and run on demand.
  - id: cheap_gate
    run: npm test              # untagged == tier:gate (default)
  - id: llm_review
    tier: audit                # excluded from the hook; runs via `run --full`
    egress: external           # sends data to a third party; skipped by --no-egress
    depends_on: [report]       # skipped (not failed) until `report` passes
    run: ./scripts/review-agent.sh
```

- **`tier: gate | audit`** — default `gate`. The hook runs gate-only so it stays fast;
  run audit judges with `validation run --full` (or set `VALIDATION_MD_HOOK_FULL=1`).
- **`egress: external`** — marks a judge that sends artifacts to a third party. `validation
  run --no-egress` skips these (use in privacy-sensitive runs).
- **`depends_on: [ids]`** — the judge is *skipped, not failed*, until its prerequisites pass
  (so a slow judge never runs before its artifact exists).
- **exists modifiers** — `non_empty`, `min_bytes`, `matches` (a regex over file contents).

### Run flags

```text
validation run --gate           # only tier:gate judges (what the hook evaluates)
validation run --full           # all judges incl. tier:audit (default for `run`)
validation run --only a,b       # run just these judge ids
validation run --skip c,d       # exclude these judge ids
validation run --no-egress      # skip judges flagged egress:external
validation run --dry-run        # list what would run, without executing
```

Skipped/planned judges never block — only a failed judge does.

## Status

This is an early exploration of a small protocol for agent validation. The useful
part is the convention: define completion in a file, run it explicitly, and turn
on hook mode only when a task needs a hard gate.

Longer term, teams should be able to publish and reuse judge packs: UI review,
code review, research review, writing voice, release readiness, and other
definitions of done.

Contributions are welcome.

## License

MIT
