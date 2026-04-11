# Phase 2: Publish Automation & Staff Commands - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto

<domain>
## Phase Boundary

Deliver the Phase 2 automation and staff-command layer: authenticated publish webhook ingest with authoritative `published_at`, raid dedupe safeguards for webhook retries and repeated submissions, roster and owner mapping for leaderboard identity, optional self-raid exclusion when owner data is trustworthy, and the `/leaderboard`, `/mystats`, and `/raiderhelp` Slack surfaces backed by the canonical scoring data. This phase does not add scheduled summaries, monthly reset jobs, reminder automation, or pilot-launch hardening work from Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Publish webhook contract
- **D-01:** Automated raid creation should use a dedicated authenticated HTTP webhook endpoint handled by the same Node/Bolt service, not a separate worker or polling flow.
- **D-02:** The publish webhook must require authoritative `published_at`, `post_url`, `client_name`, and `platform`; if `published_at` is missing, the request should fail validation instead of silently creating a low-confidence automated raid.
- **D-03:** Webhook authentication should use a shared-secret header pattern suitable for upstream workflow tooling, with payload validation and secret redaction in logs.

### Dedupe and canonical raid creation
- **D-04:** Publish automation should reuse the canonical raid creation path instead of creating a second posting code path, so manual and automated raids share message format, persistence behavior, and downstream scoring assumptions.
- **D-05:** Dedupe should prefer an upstream idempotency key when present, but it must also protect against retries or repeated submissions by normalized `(platform, post_url)` matching so duplicate publish events do not create duplicate raid posts.
- **D-06:** A duplicate publish request should return an idempotent success result that points to the already-created raid rather than failing noisily or posting again.

### Roster mapping and self-raid exclusion
- **D-07:** Team roster data should be stored durably in Postgres, keyed by Slack user ID with an active display name and optional owner identifiers or handles that can map a published post back to a team member.
- **D-08:** Self-raid exclusion should be config-driven and apply only when the webhook payload includes owner data that maps confidently to a known roster member; unmatched or ambiguous owner data should not suppress scoring.

### Staff command behavior
- **D-09:** `/leaderboard` should return a concise shared monthly ranking in Slack, while `/mystats` remains private to the requesting user and `/raiderhelp` returns private operator guidance.
- **D-10:** Command outputs must be powered by reusable reporting or query services over the canonical raid and engagement data, not by re-implementing score logic inside Slack handlers.

### the agent's Discretion
- Exact webhook route shape, request schema field names beyond the required canonical fields, and whether the auth secret is supplied as a custom header or bearer token.
- Exact normalization strategy for dedupe-safe URL comparison, as long as retried publish requests do not create second raids.
- Exact roster schema details for owner aliases or handles, as long as Slack user IDs remain the canonical team-member key.
- Exact leaderboard formatting, pagination, and help-message wording, as long as `/leaderboard`, `/mystats`, and `/raiderhelp` stay accurate and easy to use.

</decisions>

<specifics>
## Specific Ideas

- Treat publish webhook automation as the preferred raid-ingest path for launch, with manual `/raid` preserved as fallback.
- Keep webhook automation authoritative: automated raids should default to `timing_confidence = high`, with low-confidence timing reserved for manual fallback cases.
- Start roster mapping simply: one active member record per Slack user, plus optional owner handles or aliases used only for owner matching and self-raid rules.
- `/mystats` should include current-month totals and a small personal activity breakdown rather than just one raw points number.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown.
- `.planning/REQUIREMENTS.md` — Phase 2 requirement set for webhook ingest, dedupe, roster mapping, and staff commands.
- `.planning/PROJECT.md` — Product constraints, trust model, and open questions around authoritative publish timing and self-raid rules.
- `.planning/STATE.md` — Current project focus after Phase 1 completion.

### Prior phase context to preserve
- `.planning/phases/01-slack-core-trusted-scoring/01-CONTEXT.md` — Locked Phase 1 decisions around manual fallback and timing confidence.
- `.planning/phases/01-slack-core-trusted-scoring/01-RESEARCH.md` — Established architectural guidance and Bolt/Postgres patterns.

### Existing implementation surfaces
- `src/app/slack.ts` — Current Bolt and HTTP receiver bootstrap.
- `src/slack/register-commands.ts` — Current slash-command registration surface.
- `src/slack/register-events.ts` — Current event registration surface.
- `src/domain/raids/create-manual-raid.ts` — Canonical raid creation path that automated ingest should build on or share.
- `src/domain/scoring/claim-engagement.ts` — Current scoring entry point that Phase 2 reporting and self-raid logic must respect.
- `src/db/queries/engagement-logs.ts` — Canonical engagement write and reversal query layer.
- `supabase/migrations/20260410213000_phase1_core.sql` — Current schema baseline that Phase 2 must extend without breaking Phase 1 audit guarantees.

### Research guidance
- `.planning/research/SUMMARY.md` — Event-driven service direction and Phase 2 rationale.
- `.planning/research/ARCHITECTURE.md` — Recommended service boundaries for ingestion, roster, and reporting.
- `.planning/research/PITFALLS.md` — Risks around unsigned webhooks, duplicate writes, and private stats handling.
- `AGENTS.md` — Project workflow expectations and stack guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/raids/create-manual-raid.ts` already owns canonical Slack posting plus `raid_posts` persistence; Phase 2 should extend or share this path instead of bypassing it.
- `src/slack/register-commands.ts` and `src/slack/register-events.ts` already provide centralized registration seams for new slash commands and future webhook-related wiring.
- `src/domain/scoring/*` plus `src/db/queries/engagement-logs.ts` already encode the canonical scoring model Phase 2 read surfaces must report from.

### Established Patterns
- Slack handlers are thin and delegate to domain services.
- Persistence happens through focused query modules under `src/db/queries`.
- The database schema treats `raid_posts` and `engagement_logs` as the source of truth, with timing corrections stored separately for auditability.

### Integration Points
- A new HTTP route or receiver-level handler is needed for authenticated publish ingest.
- Schema support is likely needed for webhook idempotency or dedupe metadata, roster membership, and owner-to-member mapping.
- New reporting queries should sit beside existing DB query modules and feed both slash commands and later scheduled summaries.

</code_context>

<deferred>
## Deferred Ideas

- Scheduled daily, weekly, or monthly summaries.
- Reminder automation for weak first-30-minute participation.
- Monthly reset jobs and snapshotting.
- Pilot-channel UAT and deployment hardening.

</deferred>

---

*Phase: 02-publish-automation-staff-commands*
*Context gathered: 2026-04-11 via auto discuss defaults*
