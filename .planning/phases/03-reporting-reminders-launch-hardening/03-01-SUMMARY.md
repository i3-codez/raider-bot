---
phase: 03-reporting-reminders-launch-hardening
plan: 01
subsystem: reporting-jobs
tags: [nodejs, typescript, slack, reporting, cron, vitest]
requires: []
provides:
  - "Reusable ET-aware summary reporting service for daily, weekly, and monthly cadences"
  - "Slack summary payload builder with fallback text plus blocks"
  - "Scheduler-safe summary job command with dry-run support"
affects: []
tech-stack:
  added: ["@slack/web-api"]
  patterns:
    [
      "completed-window ET summary reporting",
      "summary-channel fallback to raid channel",
      "dry-run-safe scheduler entrypoints"
    ]
key-files:
  created:
    [
      src/db/queries/summary-reporting.ts,
      src/domain/reporting/summary-reporting.ts,
      src/slack/blocks/build-summary-message.ts,
      src/slack/client.ts,
      src/jobs/publish-summary.ts,
      src/scripts/run-summary-job.ts,
      tests/reporting/summary-reporting.test.ts,
      tests/jobs/publish-summary-job.test.ts
    ]
  modified:
    [src/lib/time.ts, src/config/env.ts, .env.example, package.json]
key-decisions:
  - "Scheduled summaries report the most recently completed ET window for each cadence instead of a partial in-flight window."
  - "Summary jobs post through a lightweight Slack Web API seam rather than booting the full Bolt receiver."
  - "Summary payloads reuse one formatter with fallback text and Block Kit blocks so cron output does not drift by cadence."
patterns-established:
  - "Use `getCompletedSummaryWindow(...)` as the single ET-aware cadence boundary source for scheduled reporting."
  - "Keep scheduler commands safe by making dry-run behavior explicit and testable."
requirements-completed: [RPT-01, RPT-03]
duration: 18min
completed: 2026-04-11
---

# Phase 03 Plan 01: Summary Jobs Summary

**Reusable ET-aware summaries and cron-safe summary jobs**

## Performance

- **Duration:** 18 min
- **Completed:** 2026-04-11
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added ET-aware completed-window helpers for daily, weekly, and monthly summary cadences.
- Added canonical summary reporting queries and a shared summary service with derived early-window action rate.
- Added a reusable Slack summary message builder plus a lightweight Slack Web API client for job surfaces.
- Added a scheduler-safe summary job script with dry-run support and summary-channel fallback behavior.
- Added focused tests for ET window math, derived rates, dry-run behavior, and channel fallback.

## Verification

- `npx vitest run tests/reporting/summary-reporting.test.ts` -> passed
- `npx vitest run tests/jobs/publish-summary-job.test.ts` -> passed
- `npm run typecheck` -> passed

## Deviations from Plan

None - the implementation stayed inside the planned reporting, Slack formatting, and scheduler-entrypoint split.

## Next Phase Readiness

- Phase 03-02 can now reuse one canonical summary layer for month-close snapshots instead of inventing a second reporting contract.
- Pilot and ops flows can build on the lightweight Slack client and exported summary command surface.

## Self-Check: PASSED

- Found `.planning/phases/03-reporting-reminders-launch-hardening/03-01-SUMMARY.md`
- Verified targeted reporting and job tests passed
- Verified `npm run typecheck` passed

---
*Phase: 03-reporting-reminders-launch-hardening*
*Completed: 2026-04-11*
