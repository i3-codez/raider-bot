---
phase: 01-slack-core-trusted-scoring
plan: 05
subsystem: slack
tags: [slack, slack-bolt, postgres, typescript, vitest]
requires:
  - phase: 01-02
    provides: "Bolt app bootstrap and command registration seam"
  - phase: 01-03
    provides: "Canonical raid Block Kit builder and scoring copy"
  - phase: 01-04
    provides: "raid_posts schema and shared Postgres client"
provides:
  - "Operator-only /raid modal with exact Phase 1 field order and validation rules"
  - "Manual raid creation service that posts one canonical Slack message and persists raid metadata"
  - "Modal submit bootstrap that confirms destination channel and approximate timing when publish time is omitted"
affects: [01-06-PLAN.md, 01-07-PLAN.md, 02-01-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "slash command opens a modal and delegates persistence to a domain service",
      "manual raid posting persists Slack channel and message identifiers through a dedicated query module",
      "modal submit handlers validate input before acking success and sending private confirmations"
    ]
key-files:
  created:
    [
      src/slack/commands/build-raid-modal.ts,
      src/slack/commands/register-raid-command.ts,
      src/slack/commands/handle-raid-submit.ts,
      src/domain/raids/manual-raid-input.ts,
      src/domain/raids/create-manual-raid.ts,
      src/db/queries/insert-raid-post.ts,
      tests/raid/raid-modal.test.ts,
      tests/raid/manual-raid-flow.test.ts
    ]
  modified: [src/slack/register-commands.ts, src/domain/raids/types.ts]
key-decisions:
  - "Kept `/raid` modal-first rather than parsing slash-command text so Phase 1 validation stays explicit and operator-friendly."
  - "Let the manual raid domain service own Slack posting and database persistence so the submit handler stays transport-focused."
  - "Added a shared `RaidPost` interface to stabilize the domain return shape across the new service and later correction work."
patterns-established:
  - "Use `buildRaidModal` and `parseManualRaidInput` as the shared contract for manual raid intake."
  - "Route manual raid creation through `createManualRaid` and `insertRaidPost` instead of writing Slack or SQL logic inside handlers."
  - "Bootstrap `/raid` behavior from `registerCommands(app)` with explicit command and modal-submit registration."
requirements-completed: [RAID-01, RAID-03, RAID-05, RAID-06]
duration: 7min
completed: 2026-04-10
---

# Phase 01 Plan 05: Manual Raid Flow Summary

**Operator-only `/raid` modal intake, manual raid posting, durable Slack metadata persistence, and approximate-timing confirmation flow**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T00:14:43Z
- **Completed:** 2026-04-11T00:21:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added the exact Phase 1 `/raid` modal contract, operator allowlist gate, and deterministic manual raid input validation with optional publish time.
- Implemented manual raid creation from modal submit through canonical Slack posting, persisted `raid_posts` metadata, and runtime bootstrap wiring.
- Added focused Vitest coverage for the modal contract, low-confidence fallback behavior, and private operator confirmation flow.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Open the `/raid` modal with exact Phase 1 validation rules** - `f44695b` (`test`)
2. **Task 1 GREEN: Open the `/raid` modal with exact Phase 1 validation rules** - `7f5c2d1` (`feat`)
3. **Task 2 RED: Persist the manual raid and post the canonical Slack message** - `c072a9b` (`test`)
4. **Task 2 GREEN: Persist the manual raid and post the canonical Slack message** - `e244a21` (`feat`)

## Files Created/Modified

- `src/slack/commands/build-raid-modal.ts` - Defines the exact Phase 1 modal layout, helper copy, field IDs, and callback ID.
- `src/slack/commands/register-raid-command.ts` - Registers `/raid`, enforces the operator allowlist, and opens the modal with request metadata.
- `src/domain/raids/manual-raid-input.ts` - Parses modal state into typed manual raid input, trims values, validates X URLs, and keeps `publishedAt` optional.
- `tests/raid/raid-modal.test.ts` - Locks the modal contract, validation errors, optional publish-time path, and unauthorized `/raid` denial.
- `src/slack/commands/handle-raid-submit.ts` - Registers the modal submit handler, returns field-level errors, creates the raid, and sends the operator confirmation.
- `src/domain/raids/create-manual-raid.ts` - Posts the canonical raid message, computes timing confidence and `monthKey`, and delegates row creation to the insert query.
- `src/db/queries/insert-raid-post.ts` - Inserts the canonical Phase 1 raid columns and maps the inserted row back into a shared domain object.
- `src/slack/register-commands.ts` - Bootstraps both the slash command and modal submit handler from the runtime entrypoint.
- `src/domain/raids/types.ts` - Extends the shared raid domain contract with `RaidPost`.
- `tests/raid/manual-raid-flow.test.ts` - Covers high-confidence persistence, low-confidence fallback, canonical Slack message posting, and operator confirmation copy.

## Decisions Made

- Used a Slack modal instead of freeform slash-command text so operators do not need to memorize argument order and validation stays field-specific.
- Kept manual raid posting inside the domain service, which lets the handler focus on validation, `ack`, and operator feedback instead of mixing transport with persistence.
- Returned a shared `RaidPost` shape from the insert query rather than ad hoc objects so later reaction and timing-correction flows can reuse the same contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added the shared `RaidPost` interface to `src/domain/raids/types.ts`**
- **Found during:** Task 2 (Persist the manual raid and post the canonical Slack message)
- **Issue:** The current shared raid types only exposed the platform and timing-confidence unions, but the new manual raid service needed a stable domain return shape that downstream plans can reuse.
- **Fix:** Added `RaidPost` to the shared raid types and returned that shape from the insert query and manual raid service.
- **Files modified:** `src/domain/raids/types.ts`, `src/db/queries/insert-raid-post.ts`, `src/domain/raids/create-manual-raid.ts`
- **Verification:** `npx vitest run tests/raid/raid-modal.test.ts tests/raid/manual-raid-flow.test.ts && npm run typecheck`
- **Committed in:** `e244a21`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The deviation tightened the shared raid contract without changing the Phase 1 architecture or operator-facing behavior.

## Issues Encountered

None.

## User Setup Required

None - this plan uses the Slack env configuration established in earlier Phase 1 work and did not add new external setup steps.

## Next Phase Readiness

- Plan `01-06` can now resolve scoring claims against persisted `slack_channel_id` and `slack_message_ts` values created by the manual raid path.
- Plan `01-07` can reuse the shared `RaidPost` shape, timing confidence, and `monthKey` semantics for authoritative publish-time correction.
- The Phase 1 manual creation loop is now available once the Slack app credentials from prior setup are present in the runtime environment.

## Self-Check: PASSED

- Found `.planning/phases/01-slack-core-trusted-scoring/01-05-SUMMARY.md`
- Found task commit `f44695b`
- Found task commit `7f5c2d1`
- Found task commit `c072a9b`
- Found task commit `e244a21`
