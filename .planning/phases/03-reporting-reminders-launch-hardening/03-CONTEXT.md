# Phase 3: Reporting, Reminders & Launch Hardening - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto

<domain>
## Phase Boundary

Deliver the Phase 3 reporting and launch-operations layer: scheduled daily, weekly, and monthly Slack summaries; ET-aware month-boundary handling with durable monthly snapshots; low-confidence and weak-first-30-minute reminder or ops surfacing; and the launch-readiness artifacts needed to run a private pilot safely. This phase does not add off-platform verification, a dashboard, new social platforms, or richer gamification.

</domain>

<decisions>
## Implementation Decisions

### Scheduler ownership and execution model
- **D-01:** Recurring summary and reminder jobs should be owned by the application layer and executed by Node entrypoints, with one documented scheduler owner for launch rather than ad hoc duplicate triggers.
- **D-02:** Railway cron is the default scheduler owner for the pilot, because it can run the same app code and Slack credentials without pushing Slack-posting logic into the database.
- **D-03:** Job entrypoints must support a dry-run mode so pilot validation can inspect summary and reminder payloads without posting into Slack.

### Summary behavior and destinations
- **D-04:** Daily, weekly, and monthly summaries should reuse one canonical reporting layer and publish concise leaderboard-style posts that include total points, unique raid posts engaged, early-window actions, and early-window action rate.
- **D-05:** Summary posts should go to a configurable summary channel, falling back to the raid channel when no dedicated summary channel is configured, so pilot rollout does not require extra Slack wiring.
- **D-06:** Low-confidence timing and weak-participation surfacing should go to an ops-oriented channel or destination that can default to the summary channel, rather than posting noisy public reminders into every raid thread.

### Month-boundary behavior
- **D-07:** Month boundaries must be evaluated in Eastern Time, and monthly resets should be implemented by opening a new reporting window plus snapshotting the completed month, not by mutating or deleting historical raids or engagement logs.
- **D-08:** The monthly snapshot should preserve the final per-member standings and aggregate metrics for the prior month so historical reporting remains queryable after the live leaderboard rolls into a new month.
- **D-09:** Weekly summaries should use a Monday-through-Sunday Eastern Time window so the cadence is deterministic for staff and scheduler configuration.
- **D-10:** Month-close snapshotting must be rerunnable and upsert-safe so a late timing correction or cron retry can refresh the final month view without duplicating rows.

### Reminder and alert posture
- **D-11:** Weak first-30-minute participation should be surfaced after the 20-minute mark, not at minute 10, using a simple launch-safe threshold that favors signal over channel noise.
- **D-12:** The launch reminder heuristic should treat a raid as underperforming when it is at least 20 minutes old and has fewer than 3 early-window actions, while low-confidence timing should always be eligible for ops surfacing.

### Launch hardening
- **D-13:** Pilot readiness should include explicit runbooks or docs for required env vars, scheduler commands, Slack scope expectations, manual dry-run verification, and the private pilot validation flow.

### the agent's Discretion
- Exact summary text formatting and ranking depth, as long as the required metrics remain visible and readable in Slack.
- Exact script names, route names, or module boundaries for job execution, as long as one clear scheduler owner exists.
- Exact snapshot schema shape beyond preserving per-member and aggregate monthly results.
- Exact ops message grouping for low-confidence and low-participation raids, as long as the posts are actionable and not spammy.

</decisions>

<specifics>
## Specific Ideas

- Keep the current monthly query layer as the starting point, then widen it into reusable summary payload builders instead of inventing a second reporting interpretation for jobs.
- Add one explicit job module per concern: summary generation, month-end snapshot or reset, and reminder candidate surfacing.
- Prefer a summary-channel fallback model over requiring multiple new Slack channels before pilot testing can begin.
- Make the pilot checklist runnable by a human operator with copy-paste commands and dry-run examples.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, and plan breakdown.
- `.planning/REQUIREMENTS.md` — Reporting and operations requirement set for summaries, month boundaries, and reminder surfacing.
- `.planning/PROJECT.md` — Product constraints, open questions, and ET reporting requirement.
- `.planning/STATE.md` — Current project focus after Phase 2 completion.

### Prior phase context to preserve
- `.planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md` — Locked scoring and timing source-of-truth decisions.
- `.planning/phases/02-publish-automation-staff-commands/02-CONTEXT.md` — Locked decisions around canonical reporting, owner mapping, and privacy boundaries.
- `.planning/phases/02-publish-automation-staff-commands/02-RESEARCH.md` — Existing reporting-layer and architecture guidance relevant to scheduled jobs.

### Existing implementation surfaces
- `src/domain/reporting/monthly-reporting.ts` — Current month-scoped reporting service that scheduled summaries should extend rather than bypass.
- `src/db/queries/monthly-reporting.ts` — Current canonical SQL aggregates for leaderboard and personal stats.
- `src/lib/time.ts` — Current ET month-key derivation that Phase 3 should extend for schedule windows and month boundaries.
- `src/app/server.ts` and `src/app/slack.ts` — Current runtime seams and any future route or bootstrap additions.
- `slack/app-manifest.yml` — Slack app scope baseline that pilot docs must verify.
- `supabase/migrations/20260410213000_phase1_core.sql`, `supabase/migrations/20260411050000_phase2_publish_webhook.sql`, and `supabase/migrations/20260411051000_phase2_team_roster.sql` — Current schema baseline that Phase 3 extends.

### Research guidance
- `.planning/research/SUMMARY.md` — Overall product rationale and Phase 3 positioning.
- `.planning/research/ARCHITECTURE.md` — Recommended `jobs/` layer and reporting-service boundaries.
- `.planning/research/PITFALLS.md` — ET month-boundary and reminder-noise risks.
- `AGENTS.md` — Project workflow, stack guidance, and scheduler recommendations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/reporting/monthly-reporting.ts` and `src/db/queries/monthly-reporting.ts` already expose the core monthly metrics Phase 3 needs to summarize.
- `src/lib/time.ts` already centralizes ET month-key logic and should remain the single place for report-window calculations.
- Slack command handlers already follow a thin transport pattern that scheduled jobs should mirror by delegating into shared domain services.

### Established Patterns
- Query logic lives under `src/db/queries`, domain orchestration under `src/domain`, and Slack transport details under `src/slack`.
- Durable audit data stays in Postgres; new report or snapshot state should extend the schema instead of replacing canonical logs.
- Tests rely heavily on focused unit coverage with mocked query executors and Slack clients.

### Integration Points
- Phase 3 likely needs new `src/jobs/` modules and one or more script entrypoints under `src/scripts/`.
- The env layer needs summary-channel, ops-channel, and job-auth or dry-run related configuration.
- The schema likely needs one or more snapshot or job-run tables plus indexes that support summary and reminder candidate queries.

</code_context>

<deferred>
## Deferred Ideas

- Rich thread-level reminder conversations inside every raid post.
- A separate analytics dashboard or admin UI.
- External verification APIs for claimed engagement.
- Multi-platform pilot workflows beyond the X-first launch surface.

</deferred>

---

*Phase: 03-reporting-reminders-launch-hardening*
*Context gathered: 2026-04-11 via auto discuss defaults*
