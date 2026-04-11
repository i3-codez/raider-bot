---
phase: 02-publish-automation-staff-commands
plan: 01
subsystem: publish-ingest
tags: [nodejs, typescript, slack, webhook, supabase, vitest]
requires:
  - phase: 01-04
    provides: "Canonical raid_posts schema and linked Supabase project"
  - phase: 01-05
    provides: "Existing raid creation and Slack posting flow"
  - phase: 01-07
    provides: "Authoritative publish-time correction path"
provides:
  - "Authenticated publish webhook entry point at `/publish/webhook`"
  - "Shared `createRaid(...)` ingestion path reused by manual and webhook flows"
  - "Durable dedupe fields and owner metadata on `raid_posts`"
affects: [02-02-PLAN.md, 02-03-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "Bolt custom HTTP route for non-Slack webhook ingress",
      "shared canonical raid creation service across transport surfaces",
      "database-backed dedupe using normalized post URLs and optional source event IDs"
    ]
key-files:
  created:
    [
      src/app/publish-webhook.ts,
      src/db/queries/find-raid-by-dedupe-key.ts,
      src/domain/raids/create-raid.ts,
      supabase/migrations/20260411050000_phase2_publish_webhook.sql,
      tests/raids/publish-webhook.test.ts
    ]
  modified:
    [
      src/app/slack.ts,
      src/app/server.ts,
      src/config/env.ts,
      .env.example,
      src/db/queries/insert-raid-post.ts,
      src/domain/raids/create-manual-raid.ts,
      src/domain/raids/types.ts,
      tests/raid/manual-raid-flow.test.ts,
      tests/raid/raid-modal.test.ts
    ]
key-decisions:
  - "Registered the publish webhook as a Bolt custom route so the app stays on one HTTP server instead of introducing a second runtime."
  - "Extracted `createRaid(...)` so manual and automated ingest share dedupe, timing, Slack posting, and persistence behavior."
  - "Stored raw owner metadata on `raid_posts` now so later self-raid exclusion can persist a resolved owner Slack user ID without losing upstream context."
patterns-established:
  - "Use `src/app/publish-webhook.ts` for authenticated non-Slack ingest adapters that still delegate into domain services."
  - "Use normalized post URLs plus optional source event IDs before posting to Slack so duplicate requests short-circuit safely."
requirements-completed: [RAID-02, RAID-04]
duration: 28min
completed: 2026-04-11
---

# Phase 02 Plan 01: Publish Webhook Foundation Summary

**Authenticated webhook ingest plus shared raid creation and dedupe metadata**

## Performance

- **Duration:** 28 min
- **Started:** 2026-04-11T01:00:00Z
- **Completed:** 2026-04-11T01:09:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Added `src/app/publish-webhook.ts` with a dedicated `/publish/webhook` handler that enforces `PUBLISH_WEBHOOK_SHARED_SECRET`, validates payloads with `zod`, and delegates into the shared raid-ingest service.
- Added `src/domain/raids/create-raid.ts` as the canonical creation path for both manual and webhook ingest, including duplicate suppression by normalized URL or source event ID and low-confidence manual raid upgrades through the existing timing-correction flow.
- Extended `raid_posts` persistence with durable dedupe and owner-metadata fields via `supabase/migrations/20260411050000_phase2_publish_webhook.sql`.
- Updated existing manual-flow tests plus new webhook tests so the shared ingest path is exercised without regressing Phase 1 behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Publish webhook ingest foundation and schema push** - `fff525f` (`feat`)

## Files Created/Modified

- `src/app/publish-webhook.ts` - Implements request parsing, auth, validation, and JSON responses for the publish webhook.
- `src/app/slack.ts` - Registers the custom publish route on the existing Bolt HTTP receiver.
- `src/app/server.ts` - Logs both Slack and publish endpoints at startup.
- `src/config/env.ts` and `.env.example` - Add `PUBLISH_WEBHOOK_SHARED_SECRET`.
- `src/domain/raids/create-raid.ts` - Central shared ingest service used by both manual and webhook flows.
- `src/domain/raids/create-manual-raid.ts` - Delegates into `createRaid(...)` instead of maintaining a separate posting path.
- `src/db/queries/find-raid-by-dedupe-key.ts` - Adds normalized URL and source-event dedupe lookup.
- `src/db/queries/insert-raid-post.ts` - Persists normalized URL, source event ID, and raw owner metadata, and supports metadata backfill on existing raids.
- `supabase/migrations/20260411050000_phase2_publish_webhook.sql` - Extends `raid_posts` with webhook or dedupe columns and indexes.
- `tests/raids/publish-webhook.test.ts` - Covers payload validation, owner-metadata persistence, and low-confidence raid upgrades.

## Decisions Made

- Kept webhook ingress inside Bolt’s `HTTPReceiver` custom routes rather than introducing a second standalone HTTP stack.
- Lowercased the normalized dedupe URL so repeated publish requests with minor casing differences resolve to the same raid.
- Reused the existing `correctRaidPublishedAt(...)` path when an authoritative webhook arrives after a low-confidence manual raid.

## Deviations from Plan

- The plan named `src/app/server.ts` as the primary webhook surface, but the implementation introduced `src/app/publish-webhook.ts` and registered it from `src/app/slack.ts` instead. This kept the webhook adapter testable and localized while preserving the same single-process runtime architecture.
- The implementation used one consolidated feature commit instead of separate RED/GREEN task commits.

## Verification

- `npm run typecheck` -> passed
- `npx vitest run tests/raids/publish-webhook.test.ts tests/raid/manual-raid-flow.test.ts tests/raid/raid-modal.test.ts` -> passed
- `npx vitest run` -> passed
- `npx supabase db push --linked` -> passed

## Issues Encountered

- Existing Phase 1 tests needed the new `PUBLISH_WEBHOOK_SHARED_SECRET` fixture value after the env schema changed.
- The first implementation of URL normalization preserved path casing, which weakened dedupe stability for mixed-case inputs; this was corrected before final verification.

## Next Phase Readiness

- Phase 02-02 can now assume `raid_posts` stores raw owner metadata and can later persist a resolved `owner_slack_user_id`.
- Phase 02-03 can rely on webhook-created raids entering the same canonical raid or scoring model as manual raids.

## Self-Check: PASSED

- Found `.planning/phases/02-publish-automation-staff-commands/02-01-SUMMARY.md`
- Found task commit `fff525f`
- Verified `supabase/migrations/20260411050000_phase2_publish_webhook.sql` was pushed with `npx supabase db push --linked`

---
*Phase: 02-publish-automation-staff-commands*
*Completed: 2026-04-11*
