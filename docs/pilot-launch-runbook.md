# Phase 3 Pilot Launch Runbook

Railway cron is the scheduler owner for Phase 3. It should trigger the Node scripts in this repo and nothing else; the app owns the job logic, Railway owns the timing.

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
- `SLACK_APP_TOKEN` for Socket Mode or local-only workflows, if needed

Defaults and fallbacks:

- If `SLACK_SUMMARY_CHANNEL_ID` is blank, summary posts fall back to `SLACK_RAID_CHANNEL_ID`.
- If `SLACK_OPS_CHANNEL_ID` is blank, ops surfacing falls back to `SLACK_SUMMARY_CHANNEL_ID`, then to `SLACK_RAID_CHANNEL_ID`.
- Leave `RAIDER_EXCLUDE_SELF_RAIDS` at `false` unless you need stricter self-raid filtering for a specific pilot.

## Slack App Checks

Confirm the manifest matches the installed app:

- Bot scopes: `commands`, `chat:write`, `reactions:read`
- Slash commands: `/raid`, `/leaderboard`, `/mystats`, `/raiderhelp`
- Events: `reaction_added`, `reaction_removed`
- Request URLs and event subscriptions should point to the live Railway-hosted Slack endpoint

## Railway Cron Commands

Use one cron job per scheduled surface, and invoke the package scripts directly.

```bash
npm run summary:daily
npm run summary:weekly
npm run summary:monthly
npm run month:close
npm run ops:surfacing
```

Dry-run examples for pilot validation:

```bash
npm run summary:daily -- --dry-run
npm run summary:weekly -- --dry-run
npm run summary:monthly -- --dry-run
npm run month:close -- --month=2026-03 --dry-run
npm run ops:surfacing -- --dry-run
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

## Operational Notes

- Keep schedule decisions in Railway cron; do not duplicate the same job in another scheduler during the pilot.
- Use dry-run first when changing env vars, channel IDs, or cron timing.
- If a job is noisy or misrouted, fix the channel env vars before widening the pilot.
