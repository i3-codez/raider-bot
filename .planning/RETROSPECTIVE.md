# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Raider Bot MVP

**Shipped:** 2026-04-12
**Phases:** 3 | **Plans:** 13 | **Sessions:** 2

### What Was Built
- Shipped a Slack-native raid loop with manual `/raid` intake, canonical raid posts, and durable raid plus engagement persistence.
- Added authenticated publish webhook ingest, roster-aware scoring, and staff command surfaces for leaderboard, personal stats, and help.
- Completed ET-aware summaries, month-close snapshots, ops surfacing, and a pilot-check plus runbook flow for launch operations.

### What Worked
- The phase breakdown kept infrastructure, product behavior, and ops hardening separate enough to ship quickly without losing traceability.
- Shared seams such as canonical raid creation, shared scoring config, and shared reporting services reduced drift between user-facing surfaces.

### What Was Inefficient
- Verification artifacts were produced late in the milestone rather than continuously, which created extra closeout work.
- Pilot validation could only be documented, not completed, because the credentialed Slack and Supabase environment was not available in the repo session.

### Patterns Established
- Use one canonical domain path for both operator-driven and automated ingest whenever Slack posting and persistence must stay aligned.
- Keep scheduler-facing jobs import-safe, ET-aware, and dry-run capable so pilot checks can exercise the same real code paths safely.
- Treat milestone audits as code-plus-operations evidence, with explicit separation between code gaps and environment-only debt.

### Key Lessons
1. Small, tightly scoped plans let a full MVP ship in under two days without losing artifact quality.
2. Operational validation needs an environment owner lined up before Phase 3 style hardening work begins, or milestone closeout will inherit preventable debt.

### Cost Observations
- Model mix: not tracked in local artifacts
- Sessions: 2
- Notable: the repo moved from zero implementation to shipped MVP with 13 plans, 25 tasks, and green typecheck plus test runs, which is a strong signal that the plan granularity was effective.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 3 | Established the baseline GSD rhythm for research, scoped plans, execution summaries, and milestone-level verification |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 58 passing | Not tracked | 0 |

### Top Lessons (Verified Across Milestones)

1. Not enough milestone history yet for cross-milestone verification.
2. Not enough milestone history yet for cross-milestone verification.
