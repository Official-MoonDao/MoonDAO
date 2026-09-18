# DePrize Discord bot (G1)

**Owner:** *unassigned — community ops*  
**Last updated:** 2026-09-16

No Discord surface collects a forecast or places a bet. `/bet` is a link.
Never log raw IPs. `bodyParser: false` on `/api/discord/interactions` is
mandatory — deleting it silently breaks Ed25519 verification.

`yarn discord:register` is run by ops from the ops secret store. It is
**never** a CI step. The script refuses to run without `DISCORD_GUILD_ID`
and refuses a global register.

Rollback levers: `yarn discord:register --clear` for commands; disable the
odds-wire workflow schedule (keep `workflow_dispatch`) for the wire.
Unsetting `DISCORD_PUBLIC_KEY` is **not** a rollback — Discord may disable
the Interactions URL after repeated failures.

If `DEPRIZE_OPS_ALERT_WEBHOOK_URL` is unset, the red Action is the only
alert.

## Environment

| Var | Used by | Notes |
|---|---|---|
| `DISCORD_BOT_TOKEN` | `send.ts`, register script, `postChannelMessage` | Existing. Ops secret store. |
| `DISCORD_APPLICATION_ID` | **register script only** | Not used at request time. |
| `DISCORD_PUBLIC_KEY` | interactions verify | Unset → 503. |
| `DISCORD_GUILD_ID` | register script (test guild) | Script refuses to run without it. |
| `DEPRIZE_ODDS_WIRE_CHANNEL_ID` | odds-wire cron | Unset while the schedule is enabled = misconfiguration, job red. |
| `DEPRIZE_OPS_ALERT_WEBHOOK_URL` | odds-wire cron | Optional. Unset = red Action is the only alert. |
| `CRON_SECRET` | cron route | Existing. |
| `UPSTASH_REDIS_*` | snapshot, health, lock, guild throttle | Existing. |
| `DEPLOYED_ORIGIN` / `MOONDAO_SITE_URL` | links + Actions | Existing. |

## Setup

1. Create the Application in the Discord developer portal.
2. Set the Interactions URL to `https://<host>/api/discord/interactions`.
3. `yarn discord:register` from a machine that has the ops secrets.
4. Invite the bot to the guild with `applications.commands` and send-messages
   in the wire channel.
5. Enable the odds-wire schedule only after one successful `workflow_dispatch`.
