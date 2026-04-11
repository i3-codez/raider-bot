---
phase: 01-slack-core-trusted-scoring
plan: 07
subsystem: database
tags: [typescript, postgres, slack, vitest, cli]
requires:
  - phase: 01-03
    provides: "Canonical scoring windows and the shared Slack raid message builder"
  - phase: 01-04
    provides: "Phase 1 raid, engagement, and timing-correction schema plus shared SQL access"
provides:
  - "Authoritative publish-time correction service with durable timing audit rows"
  - "Deterministic engagement score recalculation against corrected published_at values"
  - "Operator CLI for D-04 timing corrections with required flag validation"
affects: [01-05-PLAN.md, 01-06-PLAN.md, phase-1-operations]
tech-stack:
  added: []
  patterns:
    [
      "transaction-backed raid timing correction service",
      "engagement score recalculation from persisted reacted_at values",
      "manual operator workflow exposed through a guarded tsx CLI"
    ]
key-files:
  created:
    [
      src/domain/raids/correct-raid-published-at.ts,
      src/db/queries/update-raid-published-at.ts,
      src/db/queries/insert-raid-timing-correction.ts,
      src/scripts/correct-raid-published-at.ts,
      tests/raids/correct-raid-published-at.test.ts
    ]
  modified: [package.json]
key-decisions:
  - "Kept the correction flow transaction-backed so the audit insert and raid update stay coupled."
  - "Recomputed engagement facts from stored reacted_at timestamps in TypeScript and persisted only the derived scoring fields."
  - "Refreshed the Slack message through the existing canonical buildRaidMessage path so the timing row changes without forking layout logic."
patterns-established:
  - "Use correctRaidPublishedAt for D-04 authoritative timing repairs instead of ad hoc SQL updates."
  - "Persist raid_timing_corrections before mutating raid_posts when an operator rewrites published_at."
  - "Expose operator-only repair flows through package scripts that validate required flags before touching Slack or Postgres."
requirements-completed: [RAID-03, ENG-04, ENG-06]
duration: 4min
completed: 2026-04-10
---

# Phase 01 Plan 07: Timing Correction Summary

**Authoritative publish-time correction service with audit history, deterministic engagement rescoring, and a reachable operator CLI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T00:15:57Z
- **Completed:** 2026-04-11T00:19:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added the D-04 correction service that records the previous timing facts, upgrades the raid to high confidence, and recomputes engagement scoring from persisted reaction timestamps.
- Added dedicated Postgres helpers for timing-correction audit inserts and canonical raid or engagement updates without reactivating removed claims.
- Added the `correct:raid-time` operator CLI so authoritative timing repairs are executable without ad hoc code edits.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing coverage for the timing correction flow** - `471573a` (`test`)
2. **Task 1 GREEN: Implement D-04 timing correction with recalculation and Slack refresh** - `a459af7` (`feat`)
3. **Task 2: Expose the timing-correction workflow through a CLI entry point** - `1dfb4aa` (`feat`)

_Note: Task 1 followed TDD with separate RED and GREEN commits._

## Files Created/Modified

- `tests/raids/correct-raid-published-at.test.ts` - Locks the correction contract for audit-row creation, engagement recalculation, removed-at preservation, and Slack timing-row refresh.
- `src/domain/raids/correct-raid-published-at.ts` - Implements the transaction-backed D-04 correction service and canonical message update.
- `src/db/queries/insert-raid-timing-correction.ts` - Inserts the durable correction-history row with previous and new timing facts.
- `src/db/queries/update-raid-published-at.ts` - Updates `raid_posts` to the corrected authoritative timestamp and persists recalculated engagement scoring fields.
- `src/scripts/correct-raid-published-at.ts` - Parses the operator flags, rejects future timestamps, and invokes the correction service.
- `package.json` - Exposes the correction script as `npm run correct:raid-time`.

## Decisions Made

- Used the existing `buildRaidMessage` path for `chat.update` so the correction only changes the dedicated timing row and not the surrounding Block Kit composition.
- Kept recalculation based on persisted `reacted_at` values instead of replaying Slack events, which keeps the repair deterministic and audit-friendly.
- Rejected future publish timestamps in the CLI boundary so obvious operator mistakes are blocked before the database transaction starts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first GREEN attempt imported the shared SQL client eagerly, which caused unit tests to fail on env validation before the injected test store could run.
- Resolved by moving the default DB client import behind the runtime execution path while keeping the production behavior unchanged.

## User Setup Required

None - no additional setup beyond the existing Slack and Postgres environment needed by the repo.

## Next Phase Readiness

- Phase 1 operators can now repair low-confidence manual raids to authoritative publish times without hand-editing code.
- Downstream reaction and manual-raid flows can call the shared correction service once Plans `01-05` and `01-06` are fully integrated.
- `STATE.md` and `ROADMAP.md` were intentionally left untouched in this execution because the orchestrator owns those writes after the wave completes.

## Self-Check: PASSED

- Found `.planning/phases/01-slack-core-trusted-scoring/01-07-SUMMARY.md`
- Found task commit `471573a`
- Found task commit `a459af7`
- Found task commit `1dfb4aa`
