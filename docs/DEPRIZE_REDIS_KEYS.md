# DePrize Redis key-prefix registry

**Owner:** *unassigned*  
**Last updated:** 2026-09-16

Durable server-side state in the DePrize program uses the existing Upstash
instance. Prefixes are the import-graph boundary: compliance export scans
must never match a forecast, odds-wire, payload-opt-in, or rate-limit key.

| Prefix | Owner PR | Store helper | Notes |
|---|---|---|---|
| `deprize:accept:*` | existing | `acceptanceLog.ts` | Terms acceptance |
| `deprize:permit:*` | existing | `permitLog.ts` | Issued permits |
| `deprize:observation:*` | existing | `walletObservations.ts` | Wallet observations |
| `deprize:denied:*` | existing | `walletObservations.ts` | Permanent denials + audit |
| `deprize:reconcile:*` | existing | `reconcile.ts` | Cursor |
| `deprize:ofac:*` | existing | `sanctions.ts` | OFAC cache |
| `deprize:compliance:*` | reserved | — | Do not invent new keys here without the compliance owner |
| `forecast:*` | D1 | `getForecastRedis` (domain-local) | **Not** scanned by compliance export. Raw history retained 24 months after the book resolves, or until `DELETE /api/forecasts/me`. Profiles until erasure or 24 months after last submit. Aggregates (D2) may survive raw history. |
| `deprize:oddswire:{chain}:{id}` | G1 | `getOddsWireRedis` | Last-posted snapshot |
| `deprize:oddswire:health:{chain}:{id}` | G1 | `getOddsWireRedis` | Streak / lastOkAt / lastPostAt |
| `deprize:oddswire:lock:{chain}:{id}` | G1 | `getOddsWireRedis` | SET NX EX 300 run lock |
| `deprize:discord:rl:{guildId}` | G1 | `getOddsWireRedis` | Verified-guild command throttle |
| `deprize:payload:optin:*` | PR-C2 | `getPayloadOptInRedis` (domain-local) | **Not** in C; reserved |
| `deprize:onramp:*` | PR-F | `getOnrampTelemetryRedis` (domain-local) | Day-bucketed funnel counters. No PII. |
| `@upstash/ratelimit*` | platform | `middleware/rateLimit.ts` | **Do not touch.** Same Redis instance. |

A PR that adds a prefix adds a row here in the same PR.
