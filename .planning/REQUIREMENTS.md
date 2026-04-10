# Requirements: Raider Bot

**Defined:** 2026-04-10
**Core Value:** A newly published client post reaches the right staff in Slack fast enough that meaningful engagement happens inside the first 30 minutes.

## v1 Requirements

### Raid Intake

- [ ] **RAID-01**: Operator can create a raid target manually with `/raid` using a post URL, client name, and platform.
- [ ] **RAID-02**: Publishing workflow can create a raid target through an authenticated webhook that includes `published_at`.
- [ ] **RAID-03**: Each raid post stores `published_at`, `slack_posted_at`, `slack_message_ts`, `slack_channel_id`, `timing_confidence`, and `month_key`.
- [ ] **RAID-04**: Duplicate publish events or repeated manual submissions do not create duplicate raid posts.
- [ ] **RAID-05**: Raider Bot posts each new raid target into the configured Slack channel within minutes of ingest.
- [ ] **RAID-06**: Each raid target message shows the reaction legend and speed-window rules staff need to participate correctly.

### Engagement Scoring

- [ ] **ENG-01**: Supported Slack reactions map to like, comment, repost, and quote-post actions.
- [ ] **ENG-02**: A user can claim each action type at most once per post.
- [ ] **ENG-03**: Different action types stack on the same post for the same user.
- [ ] **ENG-04**: Points are calculated from `published_at` using fixed 0-10m, 10-20m, 20-30m, 30-60m, and 60m+ windows.
- [ ] **ENG-05**: Removing a reaction reverses or deactivates the associated score.
- [ ] **ENG-06**: Engagement logs retain `reacted_at`, `minutes_from_publish`, `scoring_window`, `points_awarded`, and optional `removed_at`.
- [ ] **ENG-07**: Self-raids can be excluded when a post owner is known and the rule is enabled.

### Team & Commands

- [ ] **TEAM-01**: Slack user IDs can be mapped to active leaderboard display names.
- [ ] **TEAM-02**: `/leaderboard` returns the current monthly ranking in Slack.
- [ ] **TEAM-03**: `/mystats` DMs the requesting user their current-month stats.
- [ ] **TEAM-04**: `/raiderhelp` explains the emoji mapping and scoring rules on demand.

### Reporting & Operations

- [ ] **RPT-01**: Daily, weekly, and monthly summary jobs can publish leaderboard summaries on schedule.
- [ ] **RPT-02**: Monthly scoring resets on the first of the month while historical logs remain queryable.
- [ ] **RPT-03**: Leaderboards and summaries include total points, unique raid posts engaged, early-window actions, and early-window action rate.
- [ ] **RPT-04**: Low-confidence timing and weak first-30-minute participation can be surfaced in ops summaries or reminders.

## v2 Requirements

### Verification & Expansion

- **VER-01**: System can verify claimed engagement against supported platform APIs when trust issues justify the complexity.
- **PLAT-01**: System supports additional launch-ready platform flows beyond X with platform-specific message copy and scoring guardrails.

### Analytics & Gamification

- **ANLY-01**: Admin can view client-level historical analytics outside Slack.
- **GAME-01**: Team can adopt custom emoji and richer gamification rules without rewriting the scoring engine.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Off-platform verification in MVP | Delays learning and adds unnecessary auth/API complexity |
| Full analytics dashboard in v1 | Slack summaries and commands are enough to validate the behavior loop |
| Broad multi-platform parity at launch | X-first timing behavior is the core problem to solve first |
| Custom emoji branding in v1 | Standard emoji reduce training and mapping risk |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAID-01 | Phase 1 | Pending |
| RAID-03 | Phase 1 | Pending |
| RAID-05 | Phase 1 | Pending |
| RAID-06 | Phase 1 | Pending |
| ENG-01 | Phase 1 | Pending |
| ENG-02 | Phase 1 | Pending |
| ENG-03 | Phase 1 | Pending |
| ENG-04 | Phase 1 | Pending |
| ENG-05 | Phase 1 | Pending |
| ENG-06 | Phase 1 | Pending |
| RAID-02 | Phase 2 | Pending |
| RAID-04 | Phase 2 | Pending |
| ENG-07 | Phase 2 | Pending |
| TEAM-01 | Phase 2 | Pending |
| TEAM-02 | Phase 2 | Pending |
| TEAM-03 | Phase 2 | Pending |
| TEAM-04 | Phase 2 | Pending |
| RPT-01 | Phase 3 | Pending |
| RPT-02 | Phase 3 | Pending |
| RPT-03 | Phase 3 | Pending |
| RPT-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after initial definition*
