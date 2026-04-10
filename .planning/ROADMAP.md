# Roadmap: Raider Bot

## Overview

Raider Bot should ship in three phases: first establish a trustworthy Slack scoring core, then remove manual timing gaps through publish automation and staff-facing commands, and finally add the scheduled reporting and launch guardrails that turn the bot into a repeatable operating system instead of a one-off tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): planned milestone work
- Decimal phases (2.1, 2.2): urgent insertions if new risks appear later

- [ ] **Phase 1: Slack Core & Trusted Scoring** - establish the raid message loop, scoring engine, and durable audit data.
- [ ] **Phase 2: Publish Automation & Staff Commands** - add webhook ingest, dedupe, roster mapping, and staff-facing command surfaces.
- [ ] **Phase 3: Reporting, Reminders & Launch Hardening** - add recurring summaries, monthly reset behavior, reminder hooks, and pilot readiness.

## Phase Details

### Phase 1: Slack Core & Trusted Scoring
**Goal**: Deliver a working Slack raid loop with manual creation, clear reaction guidance, deterministic scoring, and auditable engagement logs.
**Depends on**: Nothing (first phase)
**Requirements**: [RAID-01, RAID-03, RAID-05, RAID-06, ENG-01, ENG-02, ENG-03, ENG-04, ENG-05, ENG-06]
**Success Criteria** (what must be TRUE):
  1. An operator can create a raid target with `/raid` and staff see a clear Slack message with the action legend and timing rules.
  2. Staff reactions award at most one score per action type per post, while different action types still stack correctly.
  3. Reaction removal reverses or deactivates the related score without breaking the audit trail.
  4. Raid posts and engagement logs persist enough detail to explain how any Phase 1 score was produced.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Bootstrap the Bolt app, environment validation, Slack app manifest, and database schema.
- [ ] 01-02: Implement manual `/raid` creation and raid target message posting.
- [ ] 01-03: Build reaction handlers, scoring windows, dedupe rules, and engagement log persistence.

### Phase 2: Publish Automation & Staff Commands
**Goal**: Replace manual timing gaps with authenticated publish automation and give staff and admins the command surfaces they need.
**Depends on**: Phase 1
**Requirements**: [RAID-02, RAID-04, ENG-07, TEAM-01, TEAM-02, TEAM-03, TEAM-04]
**Success Criteria** (what must be TRUE):
  1. A publishing workflow can create raids automatically with an authoritative `published_at` timestamp.
  2. Duplicate publish events or retried requests do not create duplicate raid posts or duplicate scores.
  3. `/leaderboard`, `/mystats`, and `/raiderhelp` return accurate data drawn from the same canonical scoring model.
  4. Team roster mapping and optional self-raid exclusion behave predictably when owner data is present.
**Plans**: 3 plans

Plans:
- [ ] 02-01: Add authenticated publish webhook ingest, timing-confidence handling, and raid dedupe safeguards.
- [ ] 02-02: Build team roster and owner-mapping services, including optional self-raid exclusion controls.
- [ ] 02-03: Implement `/leaderboard`, `/mystats`, and `/raiderhelp` on top of reusable query services.

### Phase 3: Reporting, Reminders & Launch Hardening
**Goal**: Add recurring reinforcement loops, reliable month-boundary behavior, and the ops safeguards needed for pilot launch.
**Depends on**: Phase 2
**Requirements**: [RPT-01, RPT-02, RPT-03, RPT-04]
**Success Criteria** (what must be TRUE):
  1. Daily, weekly, and monthly summaries can post on schedule with total points and early-response metrics.
  2. Monthly reset logic starts a new score window without losing historical raid and engagement data.
  3. Low-confidence timing and weak first-30-minute participation can be surfaced automatically for ops follow-up.
  4. The bot is validated in a private pilot channel with verified scopes, scheduler ownership, and predictable report behavior.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Implement scheduled summary jobs and reusable reporting payloads.
- [ ] 03-02: Add monthly reset, snapshotting, and low-participation or low-confidence reminder logic.
- [ ] 03-03: Complete pilot UAT, deployment hardening, and ops-facing launch documentation.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Slack Core & Trusted Scoring | 0/3 | Not started | - |
| 2. Publish Automation & Staff Commands | 0/3 | Not started | - |
| 3. Reporting, Reminders & Launch Hardening | 0/3 | Not started | - |
