# Phase 3: Reporting, Reminders & Launch Hardening - Research

**Researched:** 2026-04-11
**Domain:** Scheduled summaries, ET-aware month boundaries, monthly snapshots, ops reminders, and pilot launch hardening
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md) [VERIFIED: .planning/phases/03-reporting-reminders-launch-hardening/03-CONTEXT.md]

### Locked Decisions [VERIFIED: .planning/phases/03-reporting-reminders-launch-hardening/03-CONTEXT.md]
- **D-01:** Recurring jobs should be owned by the application layer and executed by Node entrypoints with one clear scheduler owner.
- **D-02:** Railway cron is the default scheduler owner for the pilot.
- **D-03:** Job entrypoints must support dry-run mode for pilot validation.
- **D-04:** Daily, weekly, and monthly summaries should reuse one canonical reporting layer and include total points, unique raid posts engaged, early-window actions, and early-window action rate.
- **D-05:** Summary posts should target a configurable summary channel with fallback to the raid channel.
- **D-06:** Low-confidence timing and weak-participation surfacing should go to an ops-oriented destination with fallback to the summary channel.
- **D-07:** Month boundaries must be evaluated in Eastern Time, and resets should open a new reporting window plus snapshot the completed month without mutating history.
- **D-08:** Monthly snapshots should preserve final per-member standings and aggregate metrics.
- **D-09:** Weak participation should surface after 20 minutes, not 10.
- **D-10:** Launch heuristic: age at least 20 minutes plus fewer than 3 early-window actions; low-confidence timing always eligible for ops surfacing.
- **D-11:** Pilot readiness includes env docs, scheduler commands, Slack scope checks, dry-run verification, and a private pilot flow.

### the agent's Discretion [VERIFIED: .planning/phases/03-reporting-reminders-launch-hardening/03-CONTEXT.md]
- Exact summary text and Block Kit formatting.
- Exact script and module names for jobs.
- Exact monthly snapshot schema shape beyond preserving per-member and aggregate results.
- Exact grouping of ops notifications for low-confidence and low-participation raids.

</user_constraints>

<phase_requirements>
## Phase Requirements [VERIFIED: .planning/REQUIREMENTS.md]

| ID | Description | Research Support |
|----|-------------|------------------|
| RPT-01 | Daily, weekly, and monthly summary jobs can publish leaderboard summaries on schedule. | Add reusable reporting queries plus Node-run job entrypoints that post to Slack and can be scheduled by Railway cron. |
| RPT-02 | Monthly scoring resets on the first of the month while historical logs remain queryable. | Preserve live reset behavior via ET month windows and add durable monthly snapshots plus idempotent month-close job state. |
| RPT-03 | Leaderboards and summaries include total points, unique raid posts engaged, early-window actions, and early-window action rate. | Extend the canonical reporting layer so summary payloads include one derived rate field in addition to the existing counts. |
| RPT-04 | Low-confidence timing and weak first-30-minute participation can be surfaced in ops summaries or reminders. | Add reminder-candidate queries over raids and engagement logs, then publish ops-oriented notifications with launch-safe thresholds. |

</phase_requirements>

## Project Constraints (from AGENTS.md)

- Scheduled reporting must align to Eastern Time. [VERIFIED: AGENTS.md]
- Historical raids and engagement logs remain the source of truth and must survive monthly resets. [VERIFIED: AGENTS.md]
- Slack handlers and future job entrypoints should stay thin and delegate into domain services. [VERIFIED: AGENTS.md]
- Work should stay in GSD workflow structure and preserve the existing `src/app`, `src/domain`, `src/db`, `src/slack`, and `src/scripts` organization. [VERIFIED: AGENTS.md]

## Existing Codebase Signals

- `src/domain/reporting/monthly-reporting.ts` already exposes injectable month-scoped leaderboard and member-stat services, making it the natural Phase 3 reporting seam. [VERIFIED: src/domain/reporting/monthly-reporting.ts]
- `src/db/queries/monthly-reporting.ts` already derives `total_points`, `unique_raids_engaged`, `early_window_actions`, and `total_actions` from canonical logs while excluding removed claims. [VERIFIED: src/db/queries/monthly-reporting.ts]
- `src/lib/time.ts` already centralizes ET month derivation and date labeling, so Phase 3 should extend it for day or week boundaries rather than inventing separate date math. [VERIFIED: src/lib/time.ts]
- `raid_posts` already stores `published_at`, `slack_posted_at`, `timing_confidence`, `month_key`, and owner metadata, which is enough to drive low-confidence and low-participation ops logic. [VERIFIED: supabase/migrations/20260410213000_phase1_core.sql][VERIFIED: supabase/migrations/20260411050000_phase2_publish_webhook.sql]
- Current runtime bootstrapping only starts Bolt and the publish webhook; there is no existing `src/jobs/` layer or scheduler-facing entrypoint yet. [VERIFIED: src/app/server.ts][VERIFIED: src/app/slack.ts]
- The repo already has a script-entrypoint pattern in `src/scripts/correct-raid-published-at.ts`, which Phase 3 can mirror for cron-safe job scripts. [VERIFIED: src/scripts/correct-raid-published-at.ts]

## Summary

Phase 3 should extend the Phase 2 reporting layer into a reusable summary system rather than create a second interpretation of scoring data. The codebase already has the right primitives for month-scoped metrics and ET month keys, but it lacks three critical surfaces: reusable date-range reporting, scheduled job orchestration, and durable month-close or reminder state.

The strongest safe path is:
1. broaden reporting queries so daily, weekly, and monthly summaries all come from one canonical aggregate model,
2. add job modules and script entrypoints that can post summaries or ops digests with dry-run support,
3. introduce a small amount of durable scheduled-job state for monthly snapshots and idempotent job execution.

The biggest risk is not raw implementation complexity; it is drift. If Phase 3 duplicates summary math in jobs, or implements month-close behavior outside ET-aware utilities, the pilot will become hard to trust. Keep SQL and derived metrics centralized, keep Slack formatting reusable, and make each scheduled job idempotent.

## Recommended Architecture

### 1. Reusable summary reporting layer
Add a reporting module that can aggregate over explicit ET-aware windows for:
- daily,
- weekly,
- monthly,
- month-close snapshot generation.

This should build on the same canonical joins already used for `/leaderboard` and `/mystats`, while adding one derived field:
- `early_window_action_rate = early_window_actions / total_actions`

When `total_actions = 0`, the rate should be `0` instead of erroring.

### 2. Dedicated jobs and script entrypoints
Add a `src/jobs/` layer with thin orchestrators that:
- load the appropriate reporting or reminder service,
- build Slack payloads,
- post via Slack Web API,
- optionally skip posting in dry-run mode.

Prefer script entrypoints under `src/scripts/` for Railway cron commands rather than binding cron behavior to HTTP routes or Bolt startup.

### 3. Month-close snapshots and idempotency
Phase 3 does not need to delete or rewrite historical data to “reset” the month. Live leaderboards already roll over because raids store a `month_key`. The missing capability is a durable record of the prior month’s final standings plus protection against duplicate month-close runs.

Recommended durable support:
- `monthly_score_snapshots` table for final per-member standings and aggregate metrics by `month_key`
- `job_runs` table keyed by job name plus window key for idempotent summary or month-close execution

### 4. Ops reminder candidates
Add reminder-candidate queries that inspect:
- raid age from `published_at` or fallback `slack_posted_at`
- `timing_confidence`
- early-window activity count from canonical engagement logs

Launch-safe heuristic:
- low-confidence raid => always include in ops digest
- otherwise include when raid age is at least 20 minutes and early-window action count is below 3

These notifications should post to an ops-oriented destination, not to every raid thread.

### 5. Pilot hardening and runtime isolation
Do not force scheduled jobs to import the full Bolt HTTP receiver just to obtain a Slack client. Add a lightweight Slack Web API bootstrap seam for job and script use so cron execution does not depend on HTTP receiver configuration.

## Likely Code and Schema Changes

### Runtime and config
- `src/config/env.ts` and `.env.example` — add summary-channel, ops-channel, and job dry-run related configuration.
- `package.json` — add script commands for daily, weekly, monthly, month-close, reminder, and pilot dry-run execution.
- Add a small Slack client bootstrap module for jobs and scripts so they do not require the full Bolt receiver.

### Reporting and job layer
- Extend `src/lib/time.ts` with ET-aware day or week boundary helpers and reusable report-window utilities.
- Add or extend reporting queries for date-range summaries and month-close aggregates.
- Add reusable Slack summary formatting, ideally in `src/slack/blocks/`, so jobs and future command surfaces do not drift.
- Add `src/jobs/` modules for summary posting, month-close snapshotting, and ops reminder surfacing.
- Add `src/scripts/` entrypoints that call those jobs with explicit modes and dry-run support.

### Schema
- Add a migration for monthly snapshots and idempotent job-run tracking.
- Add summary or reminder-oriented indexes, especially around `raid_posts.month_key`, `published_at`, and `engagement_logs.removed_at`.

### Docs
- Add pilot launch or scheduler runbook documentation with example Railway cron commands, required env vars, dry-run commands, and private pilot validation steps.

## Patterns to Follow

### Canonical scoring-derived reporting
Keep all totals and rates derived from `engagement_logs` plus `raid_posts`. Do not add a separate mutable totals table as the live source of truth.

### ET-aware date calculations in one place
Extend `src/lib/time.ts` instead of scattering `America/New_York` formatting and boundary math through job code or SQL.

### Thin orchestration, reusable services
Jobs should look more like command handlers than ad hoc scripts: load service, call it, format payload, post or print result.

### Idempotent scheduled work
Month-close and recurring summary jobs should be safe to rerun. Use durable job-run keys or snapshot upserts to avoid duplicate output and duplicate historical rows.

## Anti-Patterns to Avoid

- Importing the full Bolt app bootstrap into every scheduled script.
- Recomputing summary metrics separately in each job instead of using one shared reporting layer.
- Defining reminder heuristics in raw scripts without a reusable service and tests.
- Treating month reset as data deletion or mutation of historical engagement logs.
- Filtering reminder candidates only by the current month key, which would miss raids that cross ET midnight.

## Testing Focus

Phase 3 planning should include tests for:
- ET month rollover in DST and standard time,
- daily, weekly, and monthly aggregate correctness,
- `early_window_action_rate` derivation including zero-action safeguards,
- summary Slack payload formatting,
- dry-run job behavior that builds payloads without posting,
- month-close snapshot idempotency,
- reminder threshold edges at 20 minutes and 3 early actions,
- low-confidence surfacing even when participation is otherwise healthy,
- cross-month reminder eligibility around ET midnight.

## Primary Recommendation

Plan Phase 3 around three executable slices:
1. reusable summary reporting plus scheduled job entrypoints,
2. month-close snapshots plus low-confidence or weak-participation ops surfacing,
3. pilot runtime hardening, Slack client isolation for jobs, env or scheduler docs, and dry-run validation flow.

This matches the roadmap’s 03-01, 03-02, and 03-03 split while keeping one canonical scoring interpretation and a clean path to pilot launch.

---

*Phase: 03-reporting-reminders-launch-hardening*
*Research completed: 2026-04-11*
