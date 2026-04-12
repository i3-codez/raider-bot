---
phase: 03-reporting-reminders-launch-hardening
verified: 2026-04-11T13:03:02Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the private-pilot dry-run and live Slack posting flow in the intended pilot channel"
    expected: "Daily, weekly, monthly summaries and ops digests route to the configured channel or documented fallback without posting during dry-run"
    why_human: "Requires a real installed Slack app, real channel IDs, and live Slack delivery behavior"
  - test: "Execute Railway cron ownership checks for the Phase 3 commands"
    expected: "Only Railway cron owns summary, month-close, and ops schedules, and each configured command runs the expected script"
    why_human: "Scheduler ownership and deployed cron configuration are outside the repository"
  - test: "Run a real month-close against the linked pilot database and inspect persisted snapshots"
    expected: "The completed ET month writes the expected monthly snapshot rows while raid_posts and engagement_logs remain intact"
    why_human: "Needs a real Supabase environment and production-like data"
---

# Phase 3: Reporting, Reminders & Launch Hardening Verification Report

**Phase Goal:** Add recurring reinforcement loops, reliable month-boundary behavior, and the ops safeguards needed for pilot launch.
**Verified:** 2026-04-11T13:03:02Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Daily, weekly, and monthly summaries can post on schedule with total points and early-response metrics. | ✓ VERIFIED | `getSummaryReport(...)` derives ET windows and pulls totals plus `earlyWindowActionRate` from SQL-backed queries in `src/domain/reporting/summary-reporting.ts:43-59` and `src/db/queries/summary-reporting.ts:79-138`; `publishSummaryJob(...)` formats and posts payloads in `src/jobs/publish-summary.ts:33-62`; summary tests passed. |
| 2 | Monthly reset logic starts a new score window without losing historical raid and engagement data. | ✓ VERIFIED | Current leaderboards still key off `deriveMonthKey(now)` in `src/domain/reporting/monthly-reporting.ts:16-27,38-49`; month-close snapshots completed months via `replaceMonthlySnapshots(...)` and `upsertJobRun(...)` in `src/domain/reporting/month-close.ts:55-106` without mutating `raid_posts` or `engagement_logs`; month-close tests passed. |
| 3 | Low-confidence timing and weak first-30-minute participation can be surfaced automatically for ops follow-up. | ✓ VERIFIED | Reminder candidates are selected from canonical raid plus engagement data in `src/db/queries/reminder-candidates.ts:47-80`; ops digest logic raises `low_confidence` and `ageMinutes >= 20 && earlyWindowActions < 3` alerts in `src/domain/reminders/ops-surfacing.ts:51-119`; publish path records dedupe state in `src/jobs/publish-ops-surfacing.ts:29-72`; reminder tests passed. |
| 4 | The bot is validated in a private pilot channel with verified scopes, scheduler ownership, and predictable report behavior. | ? NEEDS HUMAN | The repo contains the pilot-check runner, runbook, and manifest alignment (`src/scripts/run-pilot-check.ts:25-48`, `docs/pilot-launch-runbook.md:1-83`, `slack/app-manifest.yml:24-35`), but there is no programmatic proof that a real private pilot channel, installed app, or Railway cron deployment was exercised. |
| 5 | Daily, weekly, and monthly summary jobs all read from one canonical reporting layer rather than per-job custom math. | ✓ VERIFIED | `publishSummaryJob(...)` delegates to `getSummaryReport(...)` in `src/jobs/publish-summary.ts:36-43`, and `getSummaryReport(...)` delegates to `querySummaryLeaderboard(...)` and `querySummaryTotals(...)` in `src/domain/reporting/summary-reporting.ts:43-59`. |
| 6 | The scheduled summary path supports dry-run inspection and summary-channel fallback for pilot rollout. | ✓ VERIFIED | `runSummaryJobCommand(...)` parses `--dry-run` and allowed cadences in `src/scripts/run-summary-job.ts:17-57`; summary routing falls back from `SLACK_SUMMARY_CHANNEL_ID` to `SLACK_RAID_CHANNEL_ID` in `src/jobs/publish-summary.ts:29-31`; dry-run and fallback tests passed. |
| 7 | Month reset is logical and ET-aware: historical logs remain untouched while the completed month is snapshotted durably. | ✓ VERIFIED | ET month boundaries are derived in `src/lib/time.ts:215-238`; month-close uses completed monthly window or explicit `--month` override in `src/domain/reporting/month-close.ts:32-78`; durable snapshot tables exist in `supabase/migrations/20260411120000_phase3_reporting_ops.sql:1-31`. |
| 8 | Month-close and ops-surfacing jobs are idempotent and safe to rerun after cron retries or late timing corrections. | ✓ VERIFIED | Snapshot replacement is transactional and upsert-based in `src/db/queries/monthly-snapshots.ts:18-113`; `job_runs` and `ops_alert_publications` use primary-key conflict handling in `src/db/queries/job-runs.ts:35-98` and `supabase/migrations/20260411120000_phase3_reporting_ops.sql:25-39`; rerun tests passed. |
| 9 | Low-confidence timing and underperforming first-30-minute raids are surfaced through one tested ops path with durable dedupe keyed by `raid_post_id + alert_type + alert_window_key`. | ✓ VERIFIED | `buildOpsSurfacingDigest(...)` checks publication state before emitting each alert in `src/domain/reminders/ops-surfacing.ts:87-107`, and `recordOpsAlertPublication(...)` persists the composite key in `src/db/queries/job-runs.ts:86-98`; publication behavior is covered by `tests/reminders/ops-surfacing.test.ts:97-154`. |
| 10 | Pilot launch readiness is represented in runnable validation steps, not just prose. | ✓ VERIFIED | `runPilotCheck(...)` orchestrates daily, weekly, monthly, month-close, and ops dry runs in `src/scripts/run-pilot-check.ts:25-48`, and `tests/scripts/pilot-check.test.ts:25-72` covers sequencing plus missing-hook failure handling. |
| 11 | Scheduler ownership and required runtime wiring are documented clearly enough for one operator to execute without guesswork. | ✓ VERIFIED | The runbook names Railway cron as owner, lists env vars and fallback rules, and documents exact package commands in `docs/pilot-launch-runbook.md:1-83`; those commands match `package.json:7-20`, and manifest scopes/events match the runbook in `slack/app-manifest.yml:7-35`. |

**Score:** 10/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/reporting/summary-reporting.ts` | Canonical ET-aware summary reporting service | ✓ VERIFIED | Substantive service with ET window derivation and dual-query aggregation in `:1-59`; wired into summary job. |
| `src/jobs/publish-summary.ts` | Summary job orchestration for daily, weekly, and monthly posting | ✓ VERIFIED | Builds payload, resolves channel fallback, and posts only when not dry-run in `:1-62`. |
| `src/scripts/run-summary-job.ts` | Scheduler-safe summary entrypoint with dry-run support | ✓ VERIFIED | Parses cadence and `--dry-run`, creates Slack client only for live posting in `:1-71`. |
| `supabase/migrations/20260411120000_phase3_reporting_ops.sql` | Durable snapshot and job-run schema | ✓ VERIFIED | Creates `monthly_summary_snapshots`, `monthly_score_snapshots`, `job_runs`, and `ops_alert_publications` with keys and indexes in `:1-45`. |
| `src/domain/reporting/month-close.ts` | Month-close snapshot orchestration | ✓ VERIFIED | Resolves target month, reads canonical summary data, writes snapshots, and records rerunnable job state in `:1-106`. |
| `src/domain/reminders/ops-surfacing.ts` | Ops reminder heuristics and surfacing decisions | ✓ VERIFIED | Implements low-confidence and low-participation heuristics plus dedupe checks in `:1-119`. |
| `src/scripts/run-ops-surfacing.ts` | Scheduler-safe ops surfacing entrypoint | ✓ VERIFIED | Supports dry-run and live execution with optional Slack client bootstrap in `:1-52`. |
| `docs/pilot-launch-runbook.md` | Ops-facing pilot launch and Railway cron runbook | ✓ VERIFIED | Includes env setup, fallback rules, scopes, cron commands, dry-run commands, and private-pilot checklist in `:1-83`. |
| `src/scripts/run-pilot-check.ts` | Runnable pilot validation script that exercises dry-run jobs | ✓ VERIFIED | Calls summary, month-close, and ops script surfaces in order and fails fast if a hook is unavailable in `:1-64`. |
| `tests/scripts/pilot-check.test.ts` | Coverage for pilot validation flow and safety checks | ✓ VERIFIED | Substantive tests at `:25-72`; the plan helper’s literal `contains: "pilot check"` check was a false negative, but the test file does cover pilot-check behavior. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/jobs/publish-summary.ts` | `src/domain/reporting/summary-reporting.ts` | shared summary service | ✓ WIRED | Import at `src/jobs/publish-summary.ts:2-5`; call at `:36-43`. |
| `src/domain/reporting/summary-reporting.ts` | `src/db/queries/summary-reporting.ts` | canonical SQL-backed reporting | ✓ WIRED | Imports at `src/domain/reporting/summary-reporting.ts:5-10`; query calls at `:49-51`. |
| `src/jobs/publish-summary.ts` | `src/slack/blocks/build-summary-message.ts` | reusable Slack summary formatter | ✓ WIRED | Import at `src/jobs/publish-summary.ts:6`; call at `:45`. |
| `src/domain/reporting/month-close.ts` | `src/db/queries/monthly-snapshots.ts` | snapshot persistence | ✓ WIRED | Import at `src/domain/reporting/month-close.ts:10`; call at `:81-95`. |
| `src/jobs/run-month-close.ts` | `src/domain/reporting/month-close.ts` | month-close orchestration | ✓ WIRED | `runMonthCloseJob(...)` delegates directly in `src/jobs/run-month-close.ts:1-14`. |
| `src/domain/reminders/ops-surfacing.ts` | `src/db/queries/reminder-candidates.ts` | candidate selection | ✓ WIRED | Import at `src/domain/reminders/ops-surfacing.ts:2`; query call at `:58-61`. |
| `src/jobs/publish-ops-surfacing.ts` | `src/domain/reminders/ops-surfacing.ts` | ops digest generation | ✓ WIRED | Import at `src/jobs/publish-ops-surfacing.ts:2-5`; call at `:34-39`. |
| `src/scripts/run-pilot-check.ts` | `src/scripts/run-summary-job.ts` | dry-run summary validation | ✓ WIRED | Import at `src/scripts/run-pilot-check.ts:6`; calls at `:43-45`. |
| `src/scripts/run-pilot-check.ts` | `src/scripts/run-month-close.ts` | dry-run month-close validation | ✓ WIRED | Import at `src/scripts/run-pilot-check.ts:7`; call at `:46`. |
| `src/scripts/run-pilot-check.ts` | `src/scripts/run-ops-surfacing.ts` | dry-run ops validation | ✓ WIRED | Import at `src/scripts/run-pilot-check.ts:8`; call at `:47`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/domain/reporting/summary-reporting.ts` | `entries`, `totals` | `querySummaryLeaderboard(...)` and `querySummaryTotals(...)` | Yes — both queries aggregate `engagement_logs` joined to `raid_posts` and exclude `removed_at` in `src/db/queries/summary-reporting.ts:79-138` | ✓ FLOWING |
| `src/jobs/publish-summary.ts` | `report`, `payload` | `getSummaryReport(...)` then `buildSummaryMessage(...)` | Yes — dynamic ET window plus SQL-backed totals flow into Slack payload text and blocks | ✓ FLOWING |
| `src/domain/reporting/month-close.ts` | `entries`, `totals` | Monthly summary queries for completed ET window | Yes — results are written into snapshot tables through `replaceMonthlySnapshots(...)` in `src/db/queries/monthly-snapshots.ts:18-113` | ✓ FLOWING |
| `src/domain/reminders/ops-surfacing.ts` | `alerts` | `queryReminderCandidates(...)` plus `hasOpsAlertPublication(...)` | Yes — candidate raids and prior publications come from database-backed queries in `src/db/queries/reminder-candidates.ts:47-80` and `src/db/queries/job-runs.ts:70-98` | ✓ FLOWING |
| `src/jobs/publish-ops-surfacing.ts` | `digest.alerts` | `buildOpsSurfacingDigest(...)` | Yes — dynamic alert list controls Slack posting and durable publication recording in `:42-67` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Summary reporting windows and metric math | `npx vitest run tests/reporting/summary-reporting.test.ts` | `5 passed` | ✓ PASS |
| Summary job dry-run and channel fallback | `npx vitest run tests/jobs/publish-summary-job.test.ts` | `2 passed` | ✓ PASS |
| Month-close dry-run and rerun safety | `npx vitest run tests/reporting/month-close.test.ts` | `2 passed` | ✓ PASS |
| Ops surfacing heuristics and publication recording | `npx vitest run tests/reminders/ops-surfacing.test.ts` | `4 passed` | ✓ PASS |
| Pilot-check dry-run orchestration | `npx vitest run tests/scripts/pilot-check.test.ts` | `2 passed` | ✓ PASS |
| Phase 3 TypeScript surfaces | `npm run typecheck` | `tsc --noEmit` exited `0` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `RPT-01` | `03-01`, `03-03` | Daily, weekly, and monthly summary jobs can publish leaderboard summaries on schedule. | ✓ SATISFIED | Summary job/service/script chain in `src/domain/reporting/summary-reporting.ts`, `src/jobs/publish-summary.ts`, `src/scripts/run-summary-job.ts`; summary job tests passed. |
| `RPT-02` | `03-02`, `03-03` | Monthly scoring resets on the first of the month while historical logs remain queryable. | ✓ SATISFIED | Current leaderboards use current `month_key`; month-close snapshots completed month into dedicated tables in `src/domain/reporting/month-close.ts` and `src/db/queries/monthly-snapshots.ts`; month-close tests passed. |
| `RPT-03` | `03-01` | Leaderboards and summaries include total points, unique raid posts engaged, early-window actions, and early-window action rate. | ✓ SATISFIED | Summary query and message builder expose all required fields in `src/db/queries/summary-reporting.ts:1-138` and `src/slack/blocks/build-summary-message.ts:1-46`; tests passed. |
| `RPT-04` | `03-02`, `03-03` | Low-confidence timing and weak first-30-minute participation can be surfaced in ops summaries or reminders. | ✓ SATISFIED | Reminder candidate query, alert heuristics, publishing, dedupe, and pilot-facing ops runbook exist in `src/db/queries/reminder-candidates.ts`, `src/domain/reminders/ops-surfacing.ts`, `src/jobs/publish-ops-surfacing.ts`, and `docs/pilot-launch-runbook.md`; ops tests passed. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `tests/reporting/month-close.test.ts` | `47` | Rerun safety is asserted with injected in-memory stores, not a live SQL executor | ℹ️ Info | Idempotency is still supported by `ON CONFLICT` and primary keys in code/schema, but database conflict behavior is inferred rather than exercised end-to-end by this suite. |
| `src/scripts/run-summary-job.ts` | `63` | CLI failure path exists but is not directly covered by targeted tests | ℹ️ Info | Real Slack/bootstrap failures are deferred to manual pilot validation; not a blocker for code-level verification. |

### Human Verification Required

### 1. Private Pilot Slack Validation

**Test:** Install the manifest-backed app in the intended private pilot workspace, point `SLACK_SUMMARY_CHANNEL_ID` and `SLACK_OPS_CHANNEL_ID` at the pilot channel or deliberate fallback path, then run the documented dry-run and live commands.
**Expected:** Dry runs print payloads without posting; live summary and ops posts land in the configured channel or documented fallback chain.
**Why human:** Slack delivery, installed scopes, and channel routing require a real workspace and real bot token.

### 2. Railway Cron Ownership Check

**Test:** Inspect deployed Railway cron jobs and confirm they invoke only `npm run summary:daily`, `npm run summary:weekly`, `npm run summary:monthly`, `npm run month:close`, and `npm run ops:surfacing`.
**Expected:** Railway is the sole scheduler owner, with no duplicate scheduler running the same jobs elsewhere.
**Why human:** Deployed scheduler configuration is not represented in the repository.

### 3. Linked Database Month-Close Validation

**Test:** Run a real month-close against the linked pilot database after a completed ET month and inspect `monthly_summary_snapshots` and `monthly_score_snapshots`.
**Expected:** Snapshot rows match the completed ET month, `job_runs` records the execution, and canonical `raid_posts` plus `engagement_logs` remain queryable.
**Why human:** This requires a real Supabase environment and production-like persisted data.

### Gaps Summary

No code or wiring gaps were found in the Phase 3 implementation. The reason this verification is not `passed` is operational: the roadmap contract explicitly includes private-pilot validation, deployed scheduler ownership, and live report behavior, and those outcomes require human execution in the real Slack and database environments.

---

_Verified: 2026-04-11T13:03:02Z_
_Verifier: Claude (gsd-verifier)_
