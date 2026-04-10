# Architecture Research

**Domain:** Slack-native staff engagement automation for client social publishing
**Researched:** 2026-04-10
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Ingestion Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ /raid cmd   │  │ Publish hook │  │ Scheduled jobs    │   │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘   │
│         │                │                    │             │
├─────────┴────────────────┴────────────────────┴─────────────┤
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │ Slack receiver │  │ Scoring engine │  │ Report/query  │  │
│  │ + handlers     │  │ + idempotency  │  │ services      │  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬────────┘  │
│           │                   │                 │           │
├───────────┴───────────────────┴─────────────────┴───────────┤
│                       Data Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ team_members │  │ raid_posts   │  │ engagement_logs   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                         ┌───────────────────────────────┐    │
│                         │ leaderboard_snapshots         │    │
│                         └───────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Slack event receiver | Accepts commands and reaction events, validates requests, and routes to handlers | Bolt HTTP receiver with signed request verification |
| Raid ingestion service | Creates raid posts from manual or webhook input | Command handler plus authenticated webhook endpoint |
| Scoring engine | Maps emoji to actions, applies timing matrix, enforces idempotency, and reverses points on removal | Domain service with deterministic tests |
| Reporting service | Produces leaderboard, personal stats, summaries, and reminder candidates | SQL-backed query layer plus scheduled jobs |
| Persistence layer | Stores staff roster, raid posts, engagement logs, and snapshots | Postgres tables and migration files |

## Recommended Project Structure

```text
src/
├── app/                 # Bolt bootstrap and runtime wiring
│   ├── slack.ts         # app initialization and middleware
│   └── server.ts        # HTTP receiver and webhook boot
├── config/              # env parsing and app config
│   └── env.ts           # zod-validated environment variables
├── slack/               # Slack-facing handlers and message builders
│   ├── commands/        # /raid, /leaderboard, /mystats, /raiderhelp
│   ├── events/          # reaction_added, reaction_removed
│   └── blocks/          # raid and leaderboard message formatting
├── domain/              # business logic
│   ├── raids/           # raid creation and lookup
│   ├── scoring/         # timing windows and point rules
│   ├── roster/          # member lookup and owner exclusion rules
│   └── reporting/       # leaderboard and summary generation
├── db/                  # schema, queries, and migrations
│   ├── migrations/      # SQL migrations
│   └── queries/         # reusable SQL statements
├── jobs/                # scheduled summaries, resets, reminders
├── lib/                 # shared helpers
│   ├── logger.ts        # structured logging
│   ├── time.ts          # ET/month-window helpers
│   └── ids.ts           # idempotency and dedupe helpers
└── tests/               # scoring and handler-level tests
```

### Structure Rationale

- **`slack/`** keeps the transport layer thin so Slack-specific formatting does not leak into core scoring logic.
- **`domain/`** isolates product rules such as scoring windows, self-raid rules, and reminder heuristics.
- **`db/`** keeps storage concerns explicit because data correctness is central to product trust.
- **`jobs/`** separates scheduled reporting/reset behavior from real-time event handling.

## Architectural Patterns

### Pattern 1: Thin Handlers, Strong Domain Services

**What:** Slack handlers validate input, acknowledge quickly, and delegate the real logic to domain services.
**When to use:** Always for slash commands and event callbacks.
**Trade-offs:** Slightly more files up front, but much easier testing and less transport-specific coupling.

**Example:**
```typescript
app.event("reaction_added", async ({ event, client, logger }) => {
  await scoringService.handleReactionAdded(event, { client, logger });
});
```

### Pattern 2: Idempotent Write Paths

**What:** Every webhook or reaction write path should tolerate retries without changing the final score twice.
**When to use:** Manual `/raid`, publish webhooks, `reaction_added`, and `reaction_removed`.
**Trade-offs:** Requires uniqueness keys and careful query design, but prevents leaderboard corruption.

**Example:**
```typescript
await db.begin(async (tx) => {
  const existing = await tx.findEngagement(memberId, postId, actionType);
  if (existing && !existing.removedAt) return existing;
  return tx.insertEngagement(payload);
});
```

### Pattern 3: Read Models for Reporting

**What:** Use SQL views, snapshot tables, or pre-aggregated queries for leaderboard and summary output instead of rebuilding business logic in Slack handlers.
**When to use:** `/leaderboard`, `/mystats`, daily summaries, and monthly resets.
**Trade-offs:** Adds reporting queries, but makes scores explainable and repeatable.

## Data Flow

### Request Flow

```text
Publish event or /raid
    ↓
Raid ingestion service
    ↓
raid_posts record + Slack message post
    ↓
reaction_added / reaction_removed
    ↓
Scoring engine
    ↓
engagement_logs
    ↓
Leaderboard and summary queries
```

### State Management

```text
Canonical state lives in Postgres
    ↓
Slack commands and jobs query SQL read models
    ↓
Slack messages render the current state
```

### Key Data Flows

1. **Publish ingest to raid target:** Manual command or webhook creates a raid record, posts to Slack, and stores both publish and Slack timestamps.
2. **Reaction to score:** A Slack reaction event maps to an action type, computes minutes from publish, awards points, and stores an auditable log entry.
3. **Logs to summary:** Scheduled jobs aggregate monthly data into leaderboard and ops summary views, then post back into Slack.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k staff / modest raid volume | Single Node service plus Postgres is enough |
| 1k-10k staff / frequent reactions | Add queueing or background job isolation for summaries and reminders |
| 10k+ staff / high event throughput | Consider separating ingest, scoring, and reporting workers and introducing event streaming |

### Scaling Priorities

1. **First bottleneck:** repeated leaderboard aggregation queries - fix with indexed month keys, read views, and snapshots.
2. **Second bottleneck:** webhook and Slack retry storms - fix with idempotency keys, structured logging, and backoff-aware handlers.

## Anti-Patterns

### Anti-Pattern 1: Putting scoring logic inside Slack handlers

**What people do:** Mix event parsing, DB writes, timing logic, and Slack formatting in one callback.
**Why it's wrong:** Makes tests brittle and guarantees scoring bugs when new commands or reminder jobs reuse the same logic.
**Do this instead:** Keep handlers thin and route through shared domain services.

### Anti-Pattern 2: Treating leaderboard totals as the source of truth

**What people do:** Update a rolling score total without retaining the underlying engagement log.
**Why it's wrong:** Reaction removals, duplicate events, and monthly resets become hard to reconcile.
**Do this instead:** Keep `engagement_logs` canonical and derive leaderboard totals from auditable data.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Slack | Signed HTTP requests and Web API calls | Requires scopes, command registration, and message timestamp persistence |
| Publishing workflow | Authenticated webhook | Should provide `published_at`, client metadata, and canonical post URL |
| Supabase | Direct Postgres connection and optional Supabase APIs | Use pooled connections and service-role isolation carefully |
| Scheduler | Railway cron, Supabase scheduling, or n8n | Choose one clear owner for recurring jobs to avoid duplicate runs |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `slack/*` <-> `domain/*` | Function calls with typed DTOs | Keeps transport logic separate from scoring rules |
| `domain/*` <-> `db/*` | Query layer | Centralizes idempotency and reporting SQL |
| `jobs/*` <-> `domain/reporting` | Shared service methods | Scheduled output should reuse the same leaderboard/stat logic as slash commands |

## Sources

- https://docs.slack.dev/tools/bolt-js/getting-started/
- https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/
- https://docs.slack.dev/tools/bolt-js/concepts/commands
- https://supabase.com/docs/guides/database/overview
- https://supabase.com/docs/guides/functions/schedule-functions
- https://docs.railway.com/reference/cron-jobs
- Raider Bot technical specification provided on 2026-04-10

---
*Architecture research for: Slack-native staff engagement automation for client social publishing*
*Researched: 2026-04-10*
