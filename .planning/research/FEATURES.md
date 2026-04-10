# Feature Research

**Domain:** Slack-native staff engagement automation for client social publishing
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slack raid target posting | Staff need a single place to see new client posts immediately | LOW | This is the bot's distribution backbone |
| Reaction-to-action mapping | Staff need a low-friction way to claim what they did | LOW | Standard emoji are enough for MVP |
| Timeliness-based scoring | The product only works if speed matters, not just volume | MEDIUM | Needs fixed windows, test coverage, and clear messaging |
| Duplicate prevention and reaction removal handling | Scores must stay trustworthy when Slack retries events or users remove reactions | MEDIUM | Event idempotency is part of product correctness, not a nice-to-have |
| On-demand leaderboard and personal stats | Staff need visible feedback loops to keep participating | MEDIUM | These surfaces turn raw logging into behavior reinforcement |
| Persistent raid and engagement history | Reporting, resets, and audits need durable records | MEDIUM | Logs must survive monthly score resets |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Webhook-based publish ingestion with `published_at` | Preserves timing accuracy and removes manual chasing | MEDIUM | This is the biggest upgrade over manual internal workflows |
| Low-confidence timing flags | Makes fallback timing explicit instead of silently inaccurate | LOW | Important for trust in the leaderboard |
| First-30-minute leaderboard metrics | Reinforces the exact behavior Raider Bot wants to shape | MEDIUM | More useful than points alone |
| Automated reminders for weak early participation | Helps rescue posts that are underperforming in the highest-value window | MEDIUM | Should be tuned carefully to avoid channel fatigue |
| Optional self-raid exclusion | Prevents obvious gaming when the post owner is known | LOW | Best as a config toggle, not a hard-coded rule |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Off-platform engagement verification in MVP | Feels more trustworthy on paper | High API/auth complexity would slow launch and reduce learning speed | Launch with trusted claims and preserve enough log data for future auditing |
| Broad multi-platform parity on day one | Feels more complete | Splits attention away from the X-first timing loop that defines success | Keep the schema platform-aware but optimize for X first |
| Full analytics dashboard before launch | Looks polished | Adds significant UI/query scope before the Slack loop is proven | Use Slack summaries and command-driven stats first |
| Custom emoji taxonomy before adoption is proven | Feels more branded and fun | Creates avoidable training and mapping overhead | Start with standard emoji and revisit after usage patterns are clear |

## Feature Dependencies

```text
Webhook ingest
    └──requires──> raid post persistence
                           └──requires──> Slack message posting

Reaction scoring
    └──requires──> emoji mapping
                           └──requires──> raid message identification

Leaderboards and summaries
    └──requires──> durable engagement logs
                           └──requires──> accurate scoring windows

Reminders
    └──requires──> publish timing confidence
                           └──requires──> early participation metrics
```

### Dependency Notes

- **Webhook ingest requires raid post persistence:** Without a canonical `raid_posts` record, dedupe and later scoring cannot be trusted.
- **Reaction scoring requires raid message identification:** Reaction events must be tied to a known Slack message and mapped raid post.
- **Leaderboards require durable engagement logs:** Aggregates are only as good as the underlying audit trail.
- **Reminders require accurate timing confidence:** Weak reminder logic becomes noisy if `published_at` is guessed poorly.

## MVP Definition

### Launch With (v1)

- [ ] Slack raid target posting with clear action legend and timing rules - essential user loop
- [ ] Manual `/raid` fallback plus authenticated publish webhook ingestion - needed for both reliability and timing fidelity
- [ ] Reaction-based scoring with fixed windows, dedupe, and reversal handling - core product behavior
- [ ] Monthly leaderboard and personal stats commands - required feedback loop
- [ ] Scheduled daily, weekly, and monthly summaries - required reinforcement loop
- [ ] Durable audit data for raid posts, engagement logs, and monthly score history - required for trust and future iteration

### Add After Validation (v1.x)

- [ ] Automated weak-participation reminders - add once channel noise and team tolerance are understood
- [ ] Optional self-raid exclusion - add once ownership data quality is reliable
- [ ] LinkedIn raid flows - add once X-first workflow is proven and upstream timing is dependable

### Future Consideration (v2+)

- [ ] Off-platform engagement verification - add only if trust issues justify the complexity
- [ ] Client-level analytics dashboard - add after the Slack loop proves operational value
- [ ] Custom emoji and richer gamification mechanics - add once baseline participation is stable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Raid target posting | HIGH | LOW | P1 |
| Reaction-to-action mapping | HIGH | LOW | P1 |
| Timeliness scoring | HIGH | MEDIUM | P1 |
| Webhook ingest with `published_at` | HIGH | MEDIUM | P1 |
| Duplicate prevention | HIGH | MEDIUM | P1 |
| `/leaderboard` and `/mystats` | HIGH | MEDIUM | P1 |
| Scheduled summaries | MEDIUM | MEDIUM | P1 |
| Automated reminders | MEDIUM | MEDIUM | P2 |
| Self-raid exclusion | MEDIUM | LOW | P2 |
| Analytics dashboard | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Employee advocacy platforms | Manual Slack playbooks | Our Approach |
|---------|-----------------------------|------------------------|--------------|
| Content distribution | Often centralized but not always timing-optimized for one client post | Depends on a human remembering to post | Immediate Slack-native raid post with publish-timestamp awareness |
| Participation tracking | Often heavy on external auth and proof capture | Usually none beyond self-reporting in threads | Lightweight reaction claims with durable logs and scoring rules |
| Leaderboards | Often focus on totals | Usually absent | Points plus early-window metrics tied to the first 30 minutes |
| Reminders and summaries | Present in some platforms but usually generic | Ad hoc and inconsistent | Scheduled summaries plus targeted reminder hooks tied to low early participation |

## Sources

- Slack Bolt and Events API documentation for event and command interaction patterns
- Supabase documentation for scheduling and relational storage assumptions
- Raider Bot technical specification provided on 2026-04-10
- Product-pattern inference based on the provided MVP goals and operational constraints

---
*Feature research for: Slack-native staff engagement automation for client social publishing*
*Researched: 2026-04-10*
