---
phase: 03-reporting-reminders-launch-hardening
plan: 02
subsystem: month-close-ops
tags: [nodejs, typescript, postgres, supabase, reminders, vitest]
requires:
  - phase: 03-01
    provides: "Canonical summary reporting and lightweight Slack job client"
provides:
  - "Durable monthly snapshot and job-run schema"
  - "Month-close orchestration with rerunnable upsert-safe persistence"
  - "Ops surfacing for low-confidence and weak participation raids"
affects: []
tech-stack:
  added: []
  patterns:
    [
      "snapshot tables plus rerunnable job ledger",
      "ops alert dedupe keyed by raid plus alert type plus window",
      "cross-month reminder eligibility based on raid timestamps instead of current month filters"
    ]
key-files:
  created:
    [
      supabase/migrations/20260411120000_phase3_reporting_ops.sql,
      src/db/queries/job-runs.ts,
      src/db/queries/monthly-snapshots.ts,
      src/db/queries/reminder-candidates.ts,
      src/domain/reporting/month-close.ts,
      src/domain/reminders/ops-surfacing.ts,
      src/jobs/run-month-close.ts,
      src/jobs/publish-ops-surfacing.ts,
      src/scripts/run-month-close.ts,
      src/scripts/run-ops-surfacing.ts,
      tests/reporting/month-close.test.ts,
      tests/reminders/ops-surfacing.test.ts
    ]
  modified:
    [package.json]
key-decisions:
  - "Month reset remains logical rather than destructive: the prior month is snapshotted and the live leaderboard rolls forward on ET month keys."
  - "Month-close reruns refresh snapshot rows instead of creating duplicates, which keeps late timing corrections survivable."
  - "Ops surfacing dedupe is keyed by raid post, alert type, and alert window so retries stay quiet while still allowing distinct alert classes."
patterns-established:
  - "Use `job_runs` for rerunnable scheduled work state and `ops_alert_publications` for fine-grained reminder dedupe."
  - "Keep reminder candidate selection month-agnostic so ET midnight rollover does not hide eligible raids."
requirements-completed: [RPT-02, RPT-04]
duration: 21min
completed: 2026-04-11
---

# Phase 03 Plan 02: Month-Close & Ops Summary

**Durable month-close snapshots and ops surfacing**

## Performance

- **Duration:** 21 min
- **Completed:** 2026-04-11
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Added the Phase 3 Supabase migration for monthly snapshots, rerunnable job-run state, ops alert publications, and reporting indexes.
- Added month-close orchestration that derives the target month, snapshots final standings, and records rerunnable job completion.
- Added reminder candidate queries plus ops surfacing logic for low-confidence and weak early participation cases.
- Added scheduler-safe month-close and ops scripts with exported command surfaces for later pilot validation.
- Added focused tests covering dry-run month-close, rerunnable snapshot behavior, low-confidence surfacing, threshold edges, and alert publication dedupe.

## Verification

- `npx vitest run tests/reporting/month-close.test.ts` -> passed
- `npx vitest run tests/reminders/ops-surfacing.test.ts` -> passed
- `npm run typecheck` -> passed

## Deviations from Plan

None - the implementation stayed within the migration, snapshot, reminder, and script surfaces defined in the plan.

## Next Phase Readiness

- Phase 03-03 can now validate all three job paths through exported command surfaces instead of shelling out unpredictably.
- The remaining operational work is pilot-facing: runbook clarity, pilot-check orchestration, and final schema verification against the linked database.

## Self-Check: PASSED

- Found `.planning/phases/03-reporting-reminders-launch-hardening/03-02-SUMMARY.md`
- Verified month-close and ops reminder tests passed
- Verified `npm run typecheck` passed

---
*Phase: 03-reporting-reminders-launch-hardening*
*Completed: 2026-04-11*
