---
phase: 02-publish-automation-staff-commands
plan: 02
subsystem: roster
tags: [nodejs, typescript, postgres, supabase, scoring, vitest]
requires:
  - phase: 02-01
    provides: "Owner metadata persisted on raid_posts"
provides:
  - "Durable team roster and owner-alias schema"
  - "Owner-resolution and raid-owner backfill path"
  - "Optional self-raid exclusion in the scoring service"
affects: [02-03-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "persist confident owner matches onto raid_posts before applying exclusion",
      "keep owner resolution in a dedicated roster domain service",
      "gate self-raid exclusion behind an explicit env toggle"
    ]
key-files:
  created:
    [
      src/db/queries/team-members.ts,
      src/db/queries/team-member-owner-aliases.ts,
      src/db/queries/update-raid-owner-slack-user.ts,
      src/domain/roster/resolve-post-owner.ts,
      supabase/migrations/20260411051000_phase2_team_roster.sql,
      tests/roster/self-raid-exclusion.test.ts
    ]
  modified:
    [
      src/config/env.ts,
      .env.example,
      src/db/queries/find-raid-by-slack-ref.ts,
      src/domain/scoring/claim-engagement.ts
    ]
key-decisions:
  - "Resolved owner aliases once and persisted the confident match onto `raid_posts.owner_slack_user_id` instead of recomputing it on every reaction."
  - "Kept roster membership keyed by Slack user ID and stored owner aliases separately for predictable matching."
  - "Allowed scoring to proceed unchanged whenever owner resolution is ambiguous or the exclusion toggle is off."
patterns-established:
  - "Read optional owner context from `findRaidBySlackRef(...)` before scoring."
  - "Use `resolvePostOwner(...)` plus `updateRaidOwnerSlackUser(...)` as the owner-backfill path for self-raid-aware scoring."
requirements-completed: [ENG-07, TEAM-01]
duration: 18min
completed: 2026-04-11
---

# Phase 02 Plan 02: Roster & Self-Raid Summary

**Roster storage, owner-alias resolution, and optional self-raid exclusion**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-11T01:09:00Z
- **Completed:** 2026-04-11T01:13:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added `team_members` and `team_member_owner_aliases` tables plus update triggers in `20260411051000_phase2_team_roster.sql`.
- Added roster query modules and a dedicated `resolvePostOwner(...)` service for confident alias matching.
- Updated `claimEngagement(...)` to backfill `owner_slack_user_id` onto the raid record and suppress self-scoring only when `RAIDER_EXCLUDE_SELF_RAIDS=true` and the owner match is confident.
- Extended the raid lookup path so scoring has access to persisted owner metadata.

## Task Commits

1. **Task 1-2: Roster mapping and self-raid exclusion** - `6a1ea6d` (`feat`)

## Verification

- `npm run typecheck` -> passed
- `npx vitest run tests/roster/self-raid-exclusion.test.ts tests/scoring/engagement-flow.test.ts` -> passed
- `npx vitest run` -> passed
- `npx supabase db push --linked` -> passed

## Deviations from Plan

None - implementation matched the revised plan, including the explicit owner-backfill path onto `raid_posts.owner_slack_user_id`.

## Next Phase Readiness

- Phase 02-03 can now join reporting output to roster display names and trust that owner-aware scoring behavior has already been applied at write time.

## Self-Check: PASSED

- Found `.planning/phases/02-publish-automation-staff-commands/02-02-SUMMARY.md`
- Found task commit `6a1ea6d`
- Verified `supabase/migrations/20260411051000_phase2_team_roster.sql` was pushed with `npx supabase db push --linked`

---
*Phase: 02-publish-automation-staff-commands*
*Completed: 2026-04-11*
