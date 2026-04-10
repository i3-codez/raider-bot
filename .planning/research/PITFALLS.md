# Pitfalls Research

**Domain:** Slack-native staff engagement automation for client social publishing
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Scoring from Slack delivery time instead of publish time

**What goes wrong:**
Staff are rewarded or penalized based on when Slack happened to receive the raid, not when the client post actually went live.

**Why it happens:**
Teams already have `slack_posted_at` available and skip the harder upstream integration for `published_at`.

**How to avoid:**
Make `published_at` the scoring source of truth, persist `timing_confidence`, and only fall back to Slack time when the system explicitly marks the raid as low confidence.

**Warning signs:**
Scores look inconsistent with known post timing, or ops cannot explain why a "late" reaction got a top-window score.

**Phase to address:**
Phase 2 - Publish Automation & Staff Commands

---

### Pitfall 2: Duplicate event handling corrupts scores

**What goes wrong:**
Slack retries or repeated webhooks create duplicate raid posts or multiple point awards for the same action.

**Why it happens:**
Event-driven apps are often written optimistically, without idempotency keys or unique constraints.

**How to avoid:**
Use uniqueness guards for post ingest and one-score-per-action-per-user-per-post, and test retry scenarios explicitly.

**Warning signs:**
Leaderboard totals jump unexpectedly after network hiccups, or multiple identical engagement rows appear for the same member/post/action.

**Phase to address:**
Phase 2 - Publish Automation & Staff Commands

---

### Pitfall 3: Emoji mapping becomes ambiguous

**What goes wrong:**
Different emoji names, aliases, or later custom emoji additions create unclear action mapping and inconsistent scoring.

**Why it happens:**
Slack makes reactions feel casual, so teams sometimes skip a canonical mapping layer.

**How to avoid:**
Centralize emoji-to-action mapping in one config, start with standard emoji, and keep help text in sync with the stored mapping.

**Warning signs:**
Users ask what reaction to use, or support requests mention "I reacted but got no points."

**Phase to address:**
Phase 1 - Slack Core & Trusted Scoring

---

### Pitfall 4: Monthly resets run in the wrong timezone

**What goes wrong:**
Scores reset on UTC boundaries or host-local time instead of the expected Eastern Time schedule.

**Why it happens:**
Teams rely on server defaults or database defaults without defining the reporting timezone explicitly.

**How to avoid:**
Make ET explicit in scheduler config, use deterministic month keys, and test month-boundary behavior.

**Warning signs:**
Users report "missing" points around month-end, or daily summaries capture the wrong posts.

**Phase to address:**
Phase 3 - Reporting, Reminders & Launch Hardening

---

### Pitfall 5: Manual fallback quietly becomes the primary workflow

**What goes wrong:**
Operators keep using `/raid` for everything, so the product never achieves zero-manual-chasing behavior.

**Why it happens:**
Manual paths are easy to build first, and webhook automation gets pushed out when the pilot appears "good enough."

**How to avoid:**
Treat webhook ingest as a v1 requirement, not a someday enhancement, and track how many raids still enter manually.

**Warning signs:**
Most raid records have low-confidence timing or no upstream publish metadata.

**Phase to address:**
Phase 2 - Publish Automation & Staff Commands

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code emoji mapping in multiple handlers | Fast first demo | Drift between help text, scoring logic, and tests | Never |
| Store only running totals, not log rows | Simpler leaderboard queries | Impossible to reconcile removals, retries, and audits | Never |
| Skip `timing_confidence` because fallback "works" | Less schema work | Scores become unverifiable and trust erodes | Never |
| Ship reminders before measuring baseline participation | Faster gamification | Risk of channel fatigue and muted notifications | Only after early pilot feedback |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Slack Events API | Doing heavy work before acknowledging requests | Ack quickly and do durable work in services/jobs |
| Slack reactions | Matching only on emoji without a canonical raid message lookup | Verify the message is a known raid target before scoring |
| Publish webhook | Accepting unauthenticated or weakly validated payloads | Validate signature/shared secret and required fields like `post_url` and `published_at` |
| Supabase service role usage | Using a broad service key everywhere | Limit privileged access to the server runtime and keep env validation strict |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recomputing the full leaderboard on every reaction | Slack commands get slower as usage grows | Use indexed queries and scheduled snapshots where helpful | Medium raid volume |
| Full-table scans by timestamp | Summary jobs get slower each month | Index `month_key`, `post_id`, `member_id`, and active-log filters | As history grows |
| Running reporting and real-time scoring in one hot path | Delayed reaction handling during summary windows | Separate scheduled jobs from event processing | As recurring jobs expand |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Leaving publish webhooks unsigned | Anyone who knows the URL can create fake raids | Require a shared secret or signed requests |
| Logging raw service-role secrets or full webhook payloads | Credential leakage and sensitive data exposure | Redact secrets and log only needed identifiers |
| Posting personal stats publicly instead of by DM | Unnecessary staff data exposure | Keep `/mystats` private and scope outputs intentionally |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Overloaded raid messages | Staff ignore instructions or use the wrong emoji | Keep the message short, explicit, and consistent |
| Points without timing explanation | Staff do not understand why speed matters | Show the scoring windows in every raid target and help command |
| Reports that show only total points | Team optimizes for volume, not early engagement | Include early-window count and early-window rate in summaries |

## "Looks Done But Isn't" Checklist

- [ ] **Manual `/raid`:** Often missing timing-confidence fallback behavior - verify low-confidence raids are flagged.
- [ ] **Reaction scoring:** Often missing duplicate-event protection - verify repeated reactions do not inflate totals.
- [ ] **Reaction removal:** Often missing score reversal - verify removal updates downstream stats.
- [ ] **Monthly reset:** Often missing historical retention - verify old logs survive after the reset.
- [ ] **Scheduled summaries:** Often missing timezone handling - verify ET boundaries in staging data.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong timing source | MEDIUM | Backfill corrected `published_at` where possible, re-run scoring, and annotate affected leaderboard windows |
| Duplicate scores | LOW | Remove duplicate engagement rows, add missing uniqueness guards, and replay tests |
| Reminder noise | LOW | Disable reminders, tighten thresholds, and review actual first-30-minute participation data |
| Broken month reset | MEDIUM | Restore from logs/snapshots, rebuild aggregates, and add explicit ET boundary tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong timing source | Phase 2 | Raid posts store `published_at` and low-confidence fallback explicitly |
| Duplicate event handling | Phase 2 | Retry tests confirm one score per action per post per user |
| Emoji ambiguity | Phase 1 | Help text and reaction mapping come from the same canonical config |
| Wrong month reset boundary | Phase 3 | Scheduled jobs and month-key tests cover ET month turnover |
| Manual flow becoming primary | Phase 2 | Ops summary shows webhook adoption and low-confidence raid counts |

## Sources

- https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/
- https://docs.slack.dev/tools/bolt-js/concepts/commands
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/functions/schedule-functions
- Raider Bot technical specification provided on 2026-04-10
- Implementation-risk inference based on event-driven Slack apps and the provided scoring rules

---
*Pitfalls research for: Slack-native staff engagement automation for client social publishing*
*Researched: 2026-04-10*
