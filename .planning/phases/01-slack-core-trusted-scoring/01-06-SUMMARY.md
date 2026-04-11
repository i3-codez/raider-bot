---
phase: 01-slack-core-trusted-scoring
plan: 06
subsystem: slack
tags: [slack, scoring, postgres, audit-log, vitest]
requires:
  - phase: 01-02
    provides: "Slack Bolt bootstrap seams via registerEvents(app)"
  - phase: 01-03
    provides: "Canonical action registry and fixed scoring windows"
  - phase: 01-04
    provides: "raid_posts and engagement_logs persistence schema"
provides:
  - "Reaction listeners wired from registerEvents(app) into claim and reversal services"
  - "Exact raid lookup by Slack channel and message timestamp"
  - "Deterministic engagement scoring with canonical one-row-per-action persistence"
  - "Reaction removal as reversible removed_at audit state"
affects: [01-07-PLAN.md, 02-03-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "thin Slack reaction listeners delegating to scoring services",
      "database-enforced engagement dedupe via ON CONFLICT reactivation",
      "publishedAt-first scoring with slackPostedAt fallback"
    ]
key-files:
  created:
    [
      src/slack/events/register-reaction-handlers.ts,
      src/db/queries/find-raid-by-slack-ref.ts,
      src/db/queries/engagement-logs.ts,
      src/domain/scoring/claim-engagement.ts,
      src/domain/scoring/reverse-engagement.ts,
      tests/scoring/engagement-flow.test.ts
    ]
  modified: [src/slack/register-events.ts]
key-decisions:
  - "Validated reactions against the canonical ACTION_REGISTRY before any DB lookup or scoring work."
  - "Used one canonical engagement row per raid, user, and action_type, reactivating removed rows instead of inserting duplicates."
  - "Calculated score windows from raid.publishedAt first and only fell back to slackPostedAt when publish time is unavailable."
patterns-established:
  - "Wire Phase 1 Slack event listeners only through registerEvents(app); do not self-register on import."
  - "Resolve raid_posts by the exact (slack_channel_id, slack_message_ts) pair before scoring."
  - "Persist reaction reversals by updating removed_at, leaving engagement_logs rows available for audit."
requirements-completed: [ENG-04, ENG-02, ENG-03, ENG-05, ENG-06]
duration: 5min
completed: 2026-04-10
---

# Phase 01 Plan 06: Reaction Scoring Summary

**Slack reaction listeners wired into deterministic scoring services with reversible engagement audit rows and exact raid-message lookup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T00:14:47Z
- **Completed:** 2026-04-11T00:19:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Wired `registerEvents(app)` into explicit `reaction_added` and `reaction_removed` listeners so the Phase 1 scoring flow is reachable from runtime bootstrap.
- Added exact raid lookup by Slack channel ID and message timestamp before either claim or reversal work runs.
- Implemented fixed-window engagement scoring, duplicate-safe upsert semantics, reversible `removed_at` persistence, and TDD coverage for dedupe, stacking, removal, and reactivation.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing bootstrap and reaction-flow tests** - `89b2c5e` (`test`)
2. **Task 1 GREEN: Wire reaction handlers into the Slack bootstrap** - `f5608a1` (`feat`)
3. **Task 2 RED: Add failing engagement persistence tests** - `24755df` (`test`)
4. **Task 2 GREEN: Implement deterministic engagement scoring and reversal persistence** - `425caf6` (`feat`)

## Files Created/Modified

- `src/slack/register-events.ts` - Boots the reaction handlers from the shared Slack event registration seam.
- `src/slack/events/register-reaction-handlers.ts` - Registers `reaction_added` and `reaction_removed`, validates supported emoji, resolves raids, and delegates to scoring services.
- `src/db/queries/find-raid-by-slack-ref.ts` - Resolves raids by the exact persisted Slack channel and message reference pair.
- `src/db/queries/engagement-logs.ts` - Persists canonical engagement claims with conflict-based reactivation and removal updates.
- `src/domain/scoring/claim-engagement.ts` - Computes minutes-from-publish, scoring window, and awarded points before writing the canonical engagement row.
- `src/domain/scoring/reverse-engagement.ts` - Reverses a claimed action by setting `removed_at` on the canonical engagement row.
- `tests/scoring/engagement-flow.test.ts` - Locks bootstrap wiring, silent-ignore rules, duplicate delivery handling, stacking, removal, and reactivation behavior.

## Decisions Made

- Kept the reaction listeners transport-thin so Slack callbacks only validate the event, resolve the raid reference, and delegate to domain services.
- Put dedupe and reactivation semantics in the database write contract with `ON CONFLICT`, not in process-local event state.
- Left reversal as an audit-preserving update path that never deletes engagement facts.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The Task 1 bootstrap test initially leaked a module mock into the direct-handler tests; the test file was tightened so it verifies the real module boundary.
- Slack `event_ts` converts to millisecond-precision `Date` values, so the tests were corrected to assert the actual timestamp precision used by the implementation.

## User Setup Required

None - no new external service setup was introduced by this plan.

## Next Phase Readiness

- Plan `01-07` can now recalculate and refresh reaction-derived scores against existing canonical engagement rows instead of inventing its own scoring path.
- Later leaderboard and stats work can count only active engagement rows while preserving reversal history for audit and correction flows.

## Self-Check: PASSED

- Found `.planning/phases/01-slack-core-trusted-scoring/01-06-SUMMARY.md`
- Found task commit `89b2c5e`
- Found task commit `f5608a1`
- Found task commit `24755df`
- Found task commit `425caf6`

---
*Phase: 01-slack-core-trusted-scoring*
*Completed: 2026-04-10*
