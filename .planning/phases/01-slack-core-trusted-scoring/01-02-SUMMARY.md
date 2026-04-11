---
phase: 01-slack-core-trusted-scoring
plan: 02
subsystem: infra
tags: [slack, slack-bolt, http-receiver, manifest, typescript]
requires:
  - phase: 01-01
    provides: "Validated env loading, shared logger, and the runtime entrypoint used by npm start"
provides:
  - "Versioned Slack app manifest for the Phase 1 command and reaction surface"
  - "Bolt HTTPReceiver bootstrap on the shared /slack/events path"
  - "Explicit command and event registration seams for later plans"
affects: [01-03-PLAN.md, 01-05-PLAN.md, 01-06-PLAN.md]
tech-stack:
  added: []
  patterns:
    [
      "versioned Slack app manifest",
      "explicit Bolt HTTPReceiver bootstrap",
      "command and event registration via dedicated bootstrap modules"
    ]
key-files:
  created:
    [
      slack/app-manifest.yml,
      src/app/slack.ts,
      src/slack/register-commands.ts,
      src/slack/register-events.ts
    ]
  modified: [src/app/server.ts]
key-decisions:
  - "Used Bolt's explicit HTTPReceiver with the signing secret instead of custom Slack request verification code."
  - "Kept the manifest limited to /raid, reaction events, and the Phase 1 bot scopes only."
  - "Left command and event bootstrap files empty so later plans own listener registration explicitly."
patterns-established:
  - "Route Slack commands, events, and interactivity through one shared /slack/events endpoint."
  - "Construct the Bolt app in src/app/slack.ts and start it only from src/app/server.ts."
  - "Register Slack surfaces via registerCommands(app) and registerEvents(app) bootstrap seams."
requirements-completed: []
duration: 4min
completed: 2026-04-10
---

# Phase 01 Plan 02: Slack Bootstrap Summary

**Versioned Slack app manifest with a shared `/slack/events` delivery path and Bolt HTTPReceiver bootstrap seams for commands and reactions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T00:04:30Z
- **Completed:** 2026-04-11T00:08:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added a versioned Slack manifest with only the Phase 1 MVP scopes, `/raid`, and the `reaction_added` or `reaction_removed` event surface.
- Replaced the temporary foundation HTTP server entrypoint with a Bolt app bootstrap that uses `HTTPReceiver` and the validated Slack env values.
- Added explicit empty command and event registration modules so later plans can wire handlers without self-registering on import.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the versioned Slack app manifest for the Phase 1 surface** - `d565d04` (`feat`)
2. **Task 2: Create the Bolt app bootstrap, wire it into `server.ts`, and add empty registration shells** - `99665c5` (`feat`)

## Files Created/Modified

- `slack/app-manifest.yml` - Defines the Phase 1 Slack app scopes, `/raid` command, reaction subscriptions, and shared HTTP delivery path.
- `src/app/server.ts` - Starts the Bolt runtime from the `npm start` entrypoint instead of the temporary health server.
- `src/app/slack.ts` - Constructs the `HTTPReceiver`-backed Bolt app and invokes the command or event bootstrap seams.
- `src/slack/register-commands.ts` - Exposes the empty command registration seam for later slash-command wiring.
- `src/slack/register-events.ts` - Exposes the empty event registration seam for later reaction-listener wiring.

## Decisions Made

- Used an explicit `HTTPReceiver` instance so the shared `/slack/events` path and signing-secret verification are part of the bootstrap contract instead of being implicit.
- Kept the manifest constrained to `commands`, `chat:write`, and `reactions:read` to avoid widening the production Slack surface ahead of later plans.
- Preserved empty registration shells in dedicated files rather than registering placeholder listeners, so later work can extend startup without side effects.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Slack app installation still requires manual configuration:

- Set `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_RAID_CHANNEL_ID`, and `SLACK_RAID_OPERATOR_USER_IDS` in the runtime environment.
- Replace the placeholder `https://your-raider-bot.example.com/slack/events` manifest URL with the deployed base URL before importing the manifest into Slack.

## Next Phase Readiness

- Plan `01-03` can build the shared raid-message contract on top of the now-stable Slack bootstrap and manifest-owned command or event surface.
- Plans `01-05` and `01-06` can register `/raid` and reaction listeners through the explicit bootstrap seams without changing the runtime entrypoint shape.
- Live Slack traffic is still blocked on real credentials and the deployed request URL, but the code and manifest contracts for that wiring are now in place.

## Known Stubs

- `slack/app-manifest.yml:11,20,26` uses the placeholder URL `https://your-raider-bot.example.com/slack/events` until the deployed base URL is known during Slack app setup.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| `threat_flag: network-endpoint` | `src/app/server.ts` | Starts the live Bolt HTTP receiver process for Slack traffic, expanding the runtime network surface beyond the files explicitly named in the plan threat model. |

## Self-Check: PASSED

- Found `.planning/phases/01-slack-core-trusted-scoring/01-02-SUMMARY.md`
- Found task commit `d565d04`
- Found task commit `99665c5`

---
*Phase: 01-slack-core-trusted-scoring*
*Completed: 2026-04-10*
