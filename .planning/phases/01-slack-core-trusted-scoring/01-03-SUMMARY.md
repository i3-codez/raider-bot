---
phase: 01-slack-core-trusted-scoring
plan: 03
subsystem: slack
tags: [typescript, slack, block-kit, scoring, vitest]
requires:
  - "01-01 runtime foundation for shared TypeScript modules and tests"
provides:
  - "Canonical Phase 1 raid and scoring type unions"
  - "Shared emoji action registry and fixed 10/8/6/3/0 timing matrix"
  - "Canonical raid Block Kit builder sourced from shared config"
affects: [01-04-PLAN.md, 01-05-PLAN.md, 01-06-PLAN.md, 01-07-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "shared scoring config imported by message builders and downstream services",
      "single canonical emoji registry for UI copy and scoring semantics",
      "TDD-locked Slack Block Kit contract for raid posts"
    ]
key-files:
  created:
    [
      src/domain/raids/types.ts,
      src/domain/scoring/types.ts,
      src/domain/scoring/action-registry.ts,
      src/domain/scoring/scoring-config.ts,
      src/slack/blocks/build-raid-message.ts,
      tests/domain/scoring-config.test.ts,
      tests/slack/build-raid-message.test.ts
    ]
  modified: []
key-decisions:
  - "Defined the scoring-window union and fixed matrix in shared domain modules so later plans can import them without recreating labels or points."
  - "Rendered the raid legend and timing section directly from ACTION_REGISTRY and SCORING_WINDOWS to prevent drift between Slack copy and runtime scoring."
  - "Included explicit point values in the raid message timing section so staff-facing guidance is deterministic and auditable."
patterns-established:
  - "Import Platform and RaidTimingConfidence from src/domain/raids/types.ts for Phase 1 raid flows."
  - "Import ActionType, ACTION_REGISTRY, and SCORING_WINDOWS from src/domain/scoring/* instead of duplicating emoji or timing rules."
  - "Use buildRaidMessage from src/slack/blocks/build-raid-message.ts for staff-facing raid post payloads."
requirements-completed: [RAID-06, ENG-01, ENG-04]
duration: 2min
completed: 2026-04-10
---

# Phase 01 Plan 03: Shared Scoring Contracts Summary

**Canonical Phase 1 scoring types, emoji registry, fixed timing matrix, and reusable Slack raid message builder**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-11T00:06:38Z
- **Completed:** 2026-04-11T00:08:47Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added the canonical Phase 1 raid and scoring unions for platform, timing confidence, action type, and scoring-window labels.
- Centralized the Slack emoji legend and the resolved `10/8/6/3/0` timing matrix in shared domain config locked by tests.
- Implemented the reusable raid message builder with the exact low-confidence warning, footer note, legend, and timing window layout from the UI contract.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing test for shared scoring contracts** - `6c943f5` (`test`)
2. **Task 1 GREEN: Define shared scoring contracts** - `28de9c0` (`feat`)
3. **Task 2 RED: Add failing test for raid message builder** - `dba7826` (`test`)
4. **Task 2 GREEN: Implement canonical raid message builder** - `5966690` (`feat`)

## Files Created/Modified

- `src/domain/raids/types.ts` - Exports the canonical Phase 1 platform and timing-confidence unions.
- `src/domain/scoring/types.ts` - Defines shared action and scoring-window types for downstream services.
- `src/domain/scoring/action-registry.ts` - Centralizes the four canonical Slack emoji mappings and labels.
- `src/domain/scoring/scoring-config.ts` - Exports the fixed five-window `10/8/6/3/0` scoring matrix.
- `src/slack/blocks/build-raid-message.ts` - Builds the canonical Slack raid message from shared registry and timing config.
- `tests/domain/scoring-config.test.ts` - Locks the exact emoji registry, timing matrix, and shared union surface.
- `tests/slack/build-raid-message.test.ts` - Locks the exact raid message warning/footer copy and layout contract.

## Decisions Made

- Kept the Phase 1 platform union to `"x"` only, matching the X-first launch scope instead of introducing speculative multi-platform variants.
- Used shared domain config as the source for both legend copy and timing-window rendering so Slack instructions cannot drift from the scoring engine.
- Rendered timing points directly in the message window list because the UI contract allows it and it makes the staff-facing rules explicit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Plan `01-04` can import the shared scoring unions and window labels directly into the schema and audit-log types.
- Plans `01-05` and `01-07` can reuse `buildRaidMessage` for initial posting and later timing-row refresh without reauthoring staff-facing copy.
- The Phase 1 message and scoring contracts are now stable enough for downstream handler and persistence work.

## Self-Check: PASSED

- Found `.planning/phases/01-slack-core-trusted-scoring/01-03-SUMMARY.md`
- Found task commit `6c943f5`
- Found task commit `28de9c0`
- Found task commit `dba7826`
- Found task commit `5966690`
