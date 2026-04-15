# Raider Bot

Slack app that turns newly published client social posts into time-sensitive "raid" prompts for your team. When a post goes live, Raider Bot drops it into a Slack channel so staff can engage fast. Team members claim actions with emoji reactions and earn points based on speed.

Built for [Impact3](https://impact3.com). Currently targets X (Twitter), with room to extend to LinkedIn.

## How It Works

1. A webhook fires when a client post is published (carries the real `published_at` timestamp).
2. Raider Bot posts the target into the configured Slack raid channel.
3. Team members react with emojis to claim engagement actions:

| Emoji | Action |
|-------|--------|
| :heart: | Like |
| :speech_balloon: | Comment |
| :repeat: | Repost |
| :memo: | Quote post |

4. Points are scored based on how quickly after publish the reaction lands:

| Window | Points |
|--------|--------|
| 0-10 min | 10 |
| 10-20 min | 8 |
| 20-30 min | 6 |
| 30-60 min | 3 |
| 60+ min | 0 |

## Slash Commands

- `/raid` - Create a new raid target manually
- `/leaderboard` - Show the current monthly leaderboard
- `/mystats` - DM your current-month stats
- `/raiderhelp` - Show emoji mappings and scoring rules

## Stack

- **Runtime:** Node.js 24
- **Language:** TypeScript 6
- **Slack framework:** [@slack/bolt](https://docs.slack.dev/tools/bolt-js/) 4.7
- **Database:** Supabase Postgres via [postgres](https://github.com/porsager/postgres) driver
- **Validation:** Zod 4
- **Logging:** Pino

## Setup

### Prerequisites

- Node.js >= 24
- A Supabase project (or any Postgres instance)
- A Slack workspace where you can install apps

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Slack app

Import the manifest at `slack/app-manifest.yml` into your Slack workspace via [api.slack.com/apps](https://api.slack.com/apps). Update the request URLs to point to your hosted instance.

Required bot scopes: `commands`, `chat:write`, `reactions:read`

### 3. Run migrations

Apply the Supabase migrations in `supabase/migrations/` to your database.

### 4. Set environment variables

```
DATABASE_URL=              # Postgres connection string
SLACK_BOT_TOKEN=           # xoxb-... from Slack app
SLACK_SIGNING_SECRET=      # From Slack app settings
SLACK_RAID_CHANNEL_ID=     # Channel where raids are posted
SLACK_RAID_OPERATOR_USER_IDS=  # Comma-separated Slack user IDs for operators
PUBLISH_WEBHOOK_SHARED_SECRET= # Secret for authenticating inbound publish webhooks
```

Optional:

```
SLACK_SUMMARY_CHANNEL_ID=  # Channel for summary reports (falls back to raid channel)
SLACK_OPS_CHANNEL_ID=      # Channel for ops alerts (falls back to summary, then raid)
SLACK_APP_TOKEN=           # For Socket Mode (local dev)
RAIDER_EXCLUDE_SELF_RAIDS= # true/false, default false
LOG_LEVEL=                 # fatal|error|warn|info|debug|trace|silent, default info
APP_PORT=                  # default 3000
```

### 5. Run

```bash
# Development (watch mode)
npm run dev

# Production
npm run start
```

## Scheduled Jobs

These are meant to run via Railway cron (or any external scheduler):

```bash
npm run summary:daily      # Daily engagement summary
npm run summary:weekly     # Weekly summary
npm run summary:monthly    # Monthly summary
npm run month:close        # Snapshot and reset monthly scores
npm run ops:surfacing      # Surface low-confidence raids and engagement gaps
```

All jobs support `--dry-run` for testing without posting.

## Scripts

```bash
npm run correct:raid-time  # Fix a raid's published_at timestamp
npm run pilot:check        # Verify pilot environment is correctly configured
npm run typecheck          # Run TypeScript type checking
npm run test               # Run test suite
```

## Project Structure

```
src/
  app/           Server, Slack app init, webhook handler
  config/        Environment validation
  db/            SQL queries (postgres driver)
  domain/
    raids/       Raid creation and correction
    reminders/   Ops surfacing logic
    reporting/   Summaries, monthly close, snapshots
    roster/      Post-owner resolution
    scoring/     Point calculation, action registry
  jobs/          Scheduled job entry points
  lib/           Logger, time utilities
  scripts/       CLI scripts
  slack/
    blocks/      Block Kit message builders
    commands/    Slash command handlers
    events/      Reaction event handlers
slack/           Slack app manifest
supabase/        Database migrations
tests/           Vitest test suite
docs/            Launch runbook
```

## License

Private. Internal use only.
