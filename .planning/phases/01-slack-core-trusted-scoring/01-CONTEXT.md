# Phase 1: Slack Core & Trusted Scoring - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the Phase 1 Slack raid loop: manual `/raid` creation, a staff-facing Slack raid message with clear action guidance and timing rules, deterministic reaction scoring tied to `published_at`, and durable raid plus engagement audit data. This phase does not add publish webhook automation, leaderboard or personal stats commands, self-raid exclusion, or reminder and reporting loops.

</domain>

<decisions>
## Implementation Decisions

### Manual timing capture
- **D-01:** `/raid` should allow operators to create a raid even when they do not know the exact `published_at`; publish time can be supplied when known but is not required for manual creation.
- **D-02:** When manual creation does not include `published_at`, scoring should fall back to Slack post time as an explicit low-confidence path rather than blocking raid creation.
- **D-03:** Low-confidence timing must be visible in the raid message body so staff understand that timing-based scoring for that raid is approximate.
- **D-04:** If an authoritative publish time is added later for a low-confidence manual raid, the system should recalculate affected scores while preserving the underlying audit trail and correction history.

### the agent's Discretion
- Exact `/raid` command argument shape and operator ergonomics for optional publish-time entry.
- Block Kit composition and wording details for the raid message, as long as the action legend and timing rules remain clear.
- Canonical emoji selection and alias handling, as long as the mapping is centralized and the user-facing guidance stays in sync with scoring behavior.
- Exact integer points for each timing window, as long as the implementation remains deterministic, auditable, and consistent with fixed scoring windows.

</decisions>

<specifics>
## Specific Ideas

- Manual raid creation should not be blocked just because the operator lacks an exact publish timestamp.
- If timing confidence is low, staff should be told directly in the raid message instead of hiding the uncertainty in audit data only.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown.
- `.planning/REQUIREMENTS.md` — Phase 1 requirement set for manual raid intake, reaction scoring, and audit logging.
- `.planning/PROJECT.md` — Product constraints, trust model, X-first scope, and `published_at` source-of-truth guidance.
- `.planning/STATE.md` — Current project focus and open concerns that may influence planning assumptions.

### Research guidance
- `.planning/research/SUMMARY.md` — Recommended stack, architecture direction, and Phase 1 delivery rationale.
- `.planning/research/FEATURES.md` — MVP feature boundary and launch-versus-defer guidance.
- `.planning/research/ARCHITECTURE.md` — Suggested service boundaries, project structure, and canonical data flow.
- `.planning/research/PITFALLS.md` — Product and implementation risks Phase 1 should explicitly avoid.

### Project operating context
- `AGENTS.md` — Project stack recommendations and workflow guidance mirrored from planning research.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/research/ARCHITECTURE.md`: provides a recommended initial folder structure for `src/app`, `src/slack`, `src/domain`, `src/db`, and `tests`.
- `.planning/research/SUMMARY.md`: captures the expected Bolt.js plus Postgres service shape and the importance of audit-friendly scoring.
- `.planning/research/PITFALLS.md`: identifies the main Phase 1 risks around emoji ambiguity, clear raid guidance, and trustworthy logging.

### Established Patterns
- No implementation code exists yet, so Phase 1 will establish the first project patterns rather than fit into an existing codebase.
- Planning artifacts consistently treat `published_at` as the preferred scoring timestamp and Postgres-backed logs as the canonical source of truth.
- Research guidance recommends thin Slack handlers delegating to domain services and keeping scoring logic out of transport callbacks.

### Integration Points
- Slash commands are the initial operator entry point for manual raid creation.
- Slack `reaction_added` and `reaction_removed` events are the scoring triggers.
- Durable persistence must support both raid posts and per-engagement audit logs, with enough metadata to explain score calculation and later corrections.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-slack-core-trusted-scoring*
*Context gathered: 2026-04-10*
