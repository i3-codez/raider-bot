# Phase 1: Slack Core & Trusted Scoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 1-Slack Core & Trusted Scoring
**Areas discussed:** Manual timing capture

---

## Manual timing capture

| Option | Description | Selected |
|--------|-------------|----------|
| Require exact publish time input every time | Manual raids cannot be created without an operator-supplied `published_at`. | |
| Default to "publish time unknown" and let the operator optionally enter it | Manual raids can proceed without exact timing and record lower confidence when needed. | |
| Ask for a time only when the operator says the post is already live | Timing capture becomes conditional based on operator judgment. | |
| You decide | Delegate the decision to the agent. | ✓ |

**User's choice:** You decide
**Notes:** Locked default: manual `/raid` may proceed without exact `published_at`; operators can provide it when known.

| Option | Description | Selected |
|--------|-------------|----------|
| Use Slack post time as a low-confidence fallback and flag it clearly | Preserve scoring continuity while making the uncertainty explicit. | |
| Create the raid but disable scoring until a publish time is added | Preserve timing trust but introduce a dead period for engagement scoring. | |
| Reject the raid and require a real publish time | Maximize timing certainty at the cost of manual workflow friction. | |
| You decide | Delegate the decision to the agent. | ✓ |

**User's choice:** You decide
**Notes:** Locked default: missing `published_at` falls back to Slack post time with explicit low-confidence handling.

| Option | Description | Selected |
|--------|-------------|----------|
| Prominent warning in the main message body | Make timing uncertainty hard to miss for staff. | |
| Small note in the footer/context line | Keep the message cleaner while still exposing the caveat. | |
| Hidden from staff, only stored in audit data | Avoid clutter in the raid message at the cost of transparency. | |
| You decide | Delegate the decision to the agent. | ✓ |

**User's choice:** You decide
**Notes:** Locked default: low-confidence timing should be visibly called out in the raid message body.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the original score as-is for audit stability | Avoid recalculation but preserve a potentially inaccurate score. | |
| Recalculate scores from the corrected publish time and preserve the audit trail | Restore timing accuracy while keeping a record of the correction. | |
| Allow correction only before the first reaction arrives | Limit retroactive churn but reduce recovery flexibility. | |
| You decide | Delegate the decision to the agent. | ✓ |

**User's choice:** You decide
**Notes:** Locked default: corrected `published_at` should trigger score recalculation while preserving historical audit data.

## the agent's Discretion

- Raid message layout, copy, and exact Block Kit composition.
- Exact emoji mapping and alias policy.
- Exact integer scoring matrix within the fixed timing-window model.

## Deferred Ideas

None.
