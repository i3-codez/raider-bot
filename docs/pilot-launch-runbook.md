# Phase 3 Pilot Launch Runbook

Coolify's Scheduled Tasks are the scheduler owner. They trigger the Node scripts in this repo and nothing else; the app owns the job logic, Coolify owns the timing.

## Required Env

Set these before the pilot:

- `DATABASE_URL`
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_RAID_CHANNEL_ID`
- `SLACK_RAID_OPERATOR_USER_IDS`
- `PUBLISH_WEBHOOK_SHARED_SECRET`

Optional, but recommended for launch routing:

- `SLACK_SUMMARY_CHANNEL_ID`
- `SLACK_OPS_CHANNEL_ID`
- `SLACK_LEADERBOARD_CANVAS_ID` — required if you run `canvas:leaderboard`; create a channel canvas in the raid channel and paste its canvas ID here.
- `SLACK_APP_TOKEN` for Socket Mode or local-only workflows, if needed

Defaults and fallbacks:

- If `SLACK_SUMMARY_CHANNEL_ID` is blank, summary posts fall back to `SLACK_RAID_CHANNEL_ID`.
- If `SLACK_OPS_CHANNEL_ID` is blank, ops surfacing falls back to `SLACK_SUMMARY_CHANNEL_ID`, then to `SLACK_RAID_CHANNEL_ID`.
- Leave `RAIDER_EXCLUDE_SELF_RAIDS` at `false` unless you need stricter self-raid filtering for a specific pilot.

## Slack App Checks

Confirm the manifest matches the installed app:

- Bot scopes: `commands`, `chat:write`, `reactions:read`, `reactions:write`, `users:read`, `canvases:read`, `canvases:write`
- Slash commands: `/raid`, `/leaderboard`, `/mystats`, `/raiderhelp`
- Events: `reaction_added`, `reaction_removed`
- Request URLs and event subscriptions should point to the live Coolify-hosted Slack endpoint

## Scheduled Job Commands

Use one cron job per scheduled surface, and invoke the package scripts directly.

```bash
npm run summary:daily
npm run summary:weekly
npm run summary:monthly
npm run month:close
npm run ops:surfacing
npm run canvas:leaderboard
npm run monitor:x
npm run monitor:linkedin
```

Dry-run examples for pilot validation:

```bash
npm run summary:daily -- --dry-run
npm run summary:weekly -- --dry-run
npm run summary:monthly -- --dry-run
npm run month:close -- --month=2026-03 --dry-run
npm run ops:surfacing -- --dry-run
npm run canvas:leaderboard -- --dry-run
```

Pilot-check command:

```bash
npm run pilot:check
```

## Private Pilot UAT

Run this before widening access:

1. Verify the Slack app manifest is installed with the required scopes and commands.
2. Point `SLACK_SUMMARY_CHANNEL_ID` and `SLACK_OPS_CHANNEL_ID` at the private pilot channel, or leave them blank only if you want to test fallback into `SLACK_RAID_CHANNEL_ID`.
3. Run the dry-run commands above and confirm each job prints a payload without posting.
4. Run month close with a target month override in dry-run mode and confirm the label and window are correct for ET.
5. Run ops surfacing in dry-run mode and confirm low-confidence raids and under-threshold first-30-minute raids appear in the digest.
6. Turn on live posting in the private pilot channel only and verify:
   - summary posts land in the configured summary channel or the documented fallback channel
   - ops posts land in the configured ops channel or fallback chain
   - month-close writes the expected snapshot for the completed ET month
7. Check Slack message copy and channel placement before expanding beyond the private pilot.

## Deploying to Coolify

The repo ships with both a `Dockerfile` and a `nixpacks.toml`. Pick one in your Coolify service settings — the Dockerfile build pack is more predictable; Nixpacks is zero-maintenance.

### Service configuration

- **Build pack**: `Dockerfile` (recommended) or `Nixpacks`.
- **Port**: `3000` (matches the Dockerfile `EXPOSE` and `APP_PORT` default).
- **Healthcheck path**: `/health` — returns 200 when the app is up AND Supabase is reachable, 503 if the DB probe fails.

### Required env vars (set in Coolify → Environment Variables)

- `DATABASE_URL` — Supabase **Transaction pooler** connection string (port 6543). Keep the `?sslmode=require` suffix; the code also forces `ssl: "require"` on the driver.
- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `SLACK_RAID_CHANNEL_ID`
- `SLACK_RAID_OPERATOR_USER_IDS`
- `PUBLISH_WEBHOOK_SHARED_SECRET`
- `APIFY_TOKEN` — Apify account token (Apify → Settings → Integrations → Personal API tokens).

Optional:

- `SLACK_SUMMARY_CHANNEL_ID`, `SLACK_OPS_CHANNEL_ID`
- `RAIDER_EXCLUDE_SELF_RAIDS`
- `LOG_LEVEL` (default `info`)
- `APIFY_X_MONITOR_ACTOR_ID` — Apify actor slug (defaults to `danek~twitter-scraper-ppr`).
- `APIFY_LINKEDIN_MONITOR_ACTOR_ID` — Apify actor slug (defaults to `harvestapi/linkedin-profile-posts`).

### Migrations

Apply `supabase/migrations/*.sql` against the Supabase project **before** the first container start. Easiest path: paste each migration into the Supabase SQL editor in filename order. The app does not auto-migrate.

### Public URLs

Point your Slack app manifest request URLs at Coolify's generated public URL:

- Slack events / slash commands / interactivity → `/slack/events`
- Publish webhook → `/publish/webhook` (protected by `x-raider-webhook-secret` header)

### Scheduled Tasks

Coolify → Scheduled Tasks (per service). Add one entry per job; each exits on completion, so no daemon is needed.

| Task | Cron (ET → convert to UTC for Coolify) | Command |
|------|----------------------------------------|---------|
| Daily summary | `30 9 * * *` ET | `npm run summary:daily` |
| Weekly summary | `0 14 * * 1` ET | `npm run summary:weekly` |
| Monthly summary | `0 14 1 * *` ET | `npm run summary:monthly` |
| Month close | a few minutes after monthly summary | `npm run month:close` |
| Ops surfacing | your chosen cadence | `npm run ops:surfacing` |
| Canvas leaderboard | `0 * * * *` (hourly) | `npm run canvas:leaderboard` |
| X tweet monitor | `*/2 * * * *` | `npm run monitor:x` |
| LinkedIn post monitor | `*/5 * * * *` | `npm run monitor:linkedin` |

Coolify's cron scheduler runs in UTC — add or subtract the offset (ET = UTC-5 in standard, UTC-4 in daylight) when you set the expression, or hard-code slightly later UTC times and accept the DST drift.

### First-deploy smoke check

1. Deploy; wait for healthcheck to flip green.
2. Run `npm run pilot:check` via Coolify's "Run command in running container" (or a one-off Scheduled Task): verifies summary, month-close, and ops-surfacing dry-runs all succeed.
3. In the Slack workspace, run `/raiderhelp` to confirm slash commands route correctly.
4. Fire one publish webhook from your upstream (curl with the shared secret header) and verify the raid lands in `SLACK_RAID_CHANNEL_ID`.

## Operational Notes

- Keep schedule decisions in Coolify Scheduled Tasks; do not duplicate the same job in another scheduler during the pilot.
- Use dry-run first when changing env vars, channel IDs, or cron timing.
- If a job is noisy or misrouted, fix the channel env vars before widening the pilot.
- On redeploy, Coolify sends SIGTERM — the server drains in-flight handlers and closes the Postgres pool before exiting.
- LinkedIn raids land in the same `SLACK_RAID_CHANNEL_ID` as X. To populate the LinkedIn account list, edit `src/config/linkedin-clients.ts` and redeploy. Apify cost is expected to stay under $5/month at current volumes.
