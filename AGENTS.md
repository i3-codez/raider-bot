<!-- GSD:project-start source:PROJECT.md -->
## Project

**Raider Bot**

Raider Bot is a Slack-native internal app for Impact3 that turns newly published client social posts into time-sensitive "raid" prompts for staff. It posts new targets into Slack, lets staff self-report their off-platform actions with emoji reactions, and scores those actions based on both type and speed. The product is designed first for X, with room to extend to LinkedIn once the core loop is working.

**Core Value:** A newly published client post reaches the right staff in Slack fast enough that meaningful engagement happens inside the first 30 minutes.

### Constraints

- **Platform**: Slack-first app using Bolt.js - the product interaction model depends on Slack events, commands, and bot-posted messages.
- **Timing**: Score against `published_at` - fairness and product alignment break if Slack delivery time becomes the source of truth.
- **Trust Model**: Reactions are accepted as good-faith claims - MVP should avoid external API verification complexity.
- **Data Retention**: Monthly scores reset but history persists - reporting and future audits require durable logs.
- **Operational Scope**: Launch around X first - broad social parity would dilute the first release.
- **Reporting Timezone**: Scheduled summaries should align to Eastern Time - the spec defines report timing in ET and staff behavior will be judged on that cadence.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.14.1 LTS | Runtime for the Slack bot and webhook server | Current LTS is appropriate for a long-running service and aligns well with Bolt's Node-first model |
| TypeScript | 6.0.2 | Typed backend implementation | The project has event payloads, scoring rules, and data contracts that benefit from strict typing |
| `@slack/bolt` | 4.7.0 | Slack app framework for commands, events, and message posting | Bolt is the official Slack framework and cleanly handles `reaction_added`, `reaction_removed`, slash commands, and Block Kit posting |
| Supabase Postgres | Managed | Primary data store | The product needs relational storage for team members, raid posts, engagement logs, and leaderboard queries |
| `postgres` | 3.4.9 | Direct SQL driver for transactional writes and reporting queries | Direct SQL keeps scoring, dedupe, and aggregation logic close to the data model |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 | Runtime validation for webhook payloads, env vars, and Slack command inputs | Use at the boundaries where malformed input would otherwise create incorrect scores or duplicate raids |
| `pino` | 10.3.1 | Structured logging | Use for Slack event traces, webhook ingest logs, and scheduler job observability |
| `vitest` | 4.1.4 | Test runner | Use for scoring matrix tests, dedupe logic, and handler-level integration coverage |
| `tsx` | 4.21.0 | Local TypeScript execution | Use for local development scripts, migrations, and manual ops tasks |
| `@supabase/supabase-js` | 2.103.0 | Optional Supabase admin client | Use when calling Supabase-managed endpoints or RPC helpers is cleaner than raw SQL |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Slack app manifest | App scope and event configuration | Keep scopes, slash commands, and event subscriptions versioned with the codebase |
| Supabase migrations | Database schema management | Schema drift will hurt scoring logic, so migrations should be part of normal delivery |
| Railway service + cron or Supabase cron | Hosting and scheduled jobs | Choose the scheduler based on where job state is easiest to reason about |
## Installation
# Core
# Optional Supabase admin client
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Bolt HTTP receiver | Socket Mode | Use Socket Mode for local development or if you cannot expose a public request URL yet |
| `postgres` SQL driver | `@supabase/supabase-js` data calls only | Use `supabase-js` alone if the team strongly prefers RPC-style access over direct SQL |
| Railway-hosted bot | VPS/self-managed process | Use a VPS when cost control or custom networking matters more than deployment simplicity |
| Supabase `pg_cron` for DB-centric jobs | n8n scheduler | Use n8n when a non-technical operator needs to inspect and adjust cross-tool workflows visually |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| RSS as the primary publish trigger | Feed lag weakens the first-30-minute behavior Raider Bot is supposed to reinforce | Authenticated publish webhooks with `published_at` |
| Slack message timestamp as the default source of truth | Delivery lag can distort scoring fairness and early-response incentives | `published_at`, with `slack_posted_at` only as an explicit low-confidence fallback |
| Fractional timing multipliers | Harder to explain, audit, and test | Fixed integer scoring windows |
## Stack Patterns by Variant
- Use Bolt over HTTP with Slack Events API
- Because slash commands, event delivery, and webhook ingestion all fit the same deployment model
- Use Socket Mode temporarily
- Because it reduces setup friction while the production host is still being prepared
- Keep scheduled jobs close to Postgres with `pg_cron`
- Because monthly resets, snapshotting, and summary generation are data-centric
- Move reminder and reporting orchestration into n8n
- Because visible workflow steps may become more maintainable for ops
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@slack/bolt@4.7.0` | Node.js 24 LTS | Recommended pairing for a current production service |
| `typescript@6.0.2` | `tsx@4.21.0` | Good local dev loop for a TS-first service |
| `postgres@3.4.9` | Supabase Postgres | Appropriate for pooled connections and explicit SQL queries |
## Sources
- https://nodejs.org/en/about/previous-releases - verified current LTS runtime guidance
- https://docs.slack.dev/tools/bolt-js/getting-started/ - verified official Bolt for JavaScript usage
- https://docs.slack.dev/apis/events-api/comparing-http-socket-mode/ - verified HTTP vs Socket Mode trade-offs
- https://docs.slack.dev/tools/bolt-js/concepts/commands - verified command-handling patterns
- https://supabase.com/docs/guides/database/overview - verified Postgres-first Supabase architecture
- https://supabase.com/docs/guides/functions/schedule-functions - verified scheduling options in the Supabase ecosystem
- https://docs.railway.com/reference/cron-jobs - verified hosted scheduler support
- npm registry queries on 2026-04-10 for `@slack/bolt`, `typescript`, `postgres`, `zod`, `pino`, `vitest`, `tsx`, and `@supabase/supabase-js`
- Raider Bot technical specification provided on 2026-04-10
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
