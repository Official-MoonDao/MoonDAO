# Citizen renewal reminders

Dry run by default. The route reads chain, Tableland, Typeform, Kit, and Redis. It does not send email. Kit sends the sequence after a tag is applied.

Live Kit writes run only when both of these are true:

- server env `RENEWAL_REMINDERS_LIVE` is exactly `true`
- the request query includes `live=1`

Either one alone stays a dry run: no tag adds, no tag removes, and no Redis dedupe writes. `dryRun=0` is still rejected. Omit `dryRun` or pass `dryRun=1`.

This job does not create, re-subscribe, or re-activate subscribers. It does not call form subscribe or sequence subscribe. Typeform-only addresses are counted and masked. They are not added to Kit in this change.

Reminders are on by default. A citizen with a findable email is in the reminder set unless they opted out. Opt-out is Kit state `cancelled`, `unsubscribed`, `bounced`, or `complained`, or the Redis set `renewal:suppress`. There is no opt-in checkbox. A later change can add a "stop renewal reminders" link that writes one of those opt-outs.

## One tag, one sequence

Tag name: `Renewal-Reminder`. Override with `RENEWAL_REMINDER_TAG_NAME`. Id from `RENEWAL_REMINDER_TAG_ID`, or a lookup of that name.

On day -30 (exactly 30 days before `expiresAt`), live mode adds that tag to an existing active Kit subscriber. A Kit automation subscribes tagged people to one sequence. The sequence sends on day 0, day 23, day 30, and day 44 after entry. Those dates are 30 days before expiry, 7 days before expiry, expiry day, and 14 days after expiry.

Kit delay change for sequence 2929996: the wait after the first email changes from 16 days to 23 days, and the wait after the second email changes from 14 days to 7 days. The wait after the expiry-day email stays 14 days. Send hour and time zone are unchanged by this code.

Kit times a sequence from the day someone enters it. Tagging a person who is already inside the window would send the first email on the wrong date. The code does not start the sequence itself.

## Catch-up tags

Anyone already past day -30 when first seen for that `expiresAt` does not get `Renewal-Reminder`. They get one catch-up tag for the next email that is still due. Earlier emails stay unsent. That catch-up tag is the only stage for the term. Later runs do not add another one.

| Next email           | Default tag              | Name env                          | Id env                          |
| -------------------- | ------------------------ | --------------------------------- | ------------------------------- |
| 7 days before expiry | `Renewal-Catchup-minus7` | `RENEWAL_CATCHUP_MINUS7_TAG_NAME` | `RENEWAL_CATCHUP_MINUS7_TAG_ID` |
| expiry day           | `Renewal-Catchup-expiry` | `RENEWAL_CATCHUP_EXPIRY_TAG_NAME` | `RENEWAL_CATCHUP_EXPIRY_TAG_ID` |
| 14 days after expiry | `Renewal-Catchup-plus14` | `RENEWAL_CATCHUP_PLUS14_TAG_NAME` | `RENEWAL_CATCHUP_PLUS14_TAG_ID` |

Someone 20 days out has missed the -30 email and gets `Renewal-Catchup-minus7`. Someone on expiry day gets `Renewal-Catchup-expiry`. Someone 14 days past expiry gets `Renewal-Catchup-plus14`. The -7 tag id stays env-overridable. If `RENEWAL_CATCHUP_MINUS7_TAG_ID` is unset, the job uses tag id `24636918` (the previous -14 catch-up tag) until Beacon sets a new id or retargets that automation to the -7 email.

Create one Kit automation per catch-up tag that sends only that email. Do not attach catch-up tags to the four-email sequence.

## One stage per term

A term is one token id and one `expiresAt`. The job writes at most one reminder or catch-up stage for that term: `Renewal-Reminder`, `Renewal-Catchup-minus7`, `Renewal-Catchup-expiry`, or `Renewal-Catchup-plus14`.

The first time someone is seen inside the window with no stage written for that term, they get the tag for the stage due that day. Day -30 gets `Renewal-Reminder`. A later first sighting gets the catch-up tag for the next email, same as above. Runs after that write nothing else for the term. A person tagged at day -30 does not later receive the -7, expiry, or +14 catch-up tags. A person first seen at 20 days gets only the -7 catch-up, and does not get the expiry or +14 tags on later days.

After that tag succeeds, the job sets Redis key `renewal:term:{tokenId}:{expiresAt}` to the stage id (`minus30`, `minus7`, `expiry`, or `plus14`). Planning reads that marker. The same fact can be derived from `renewal:written` members shaped `renewal:{tokenId}:{expiresAt}:{stage}` for those four stages. A stored `minus14` member counts as `minus7`. `renewed` does not occupy the slot. Dry runs read the term markers and the written set. They do not write them.

A row blocked by this rule is skipped as `alreadyStagedThisTerm`. That count sits with the other skip counts. Each skipped row includes the token id, the tag name already written, the stage already written, and the stage that would have applied.

When `expiresAt` changes, the pair is a new term and can be staged again. The Renewed swap below is unchanged.

A future win-back stage may be allowed after the staged email. It is not built. The extension point is `WIN_BACK_STAGES` in `ui/lib/citizen/renewalCoverageLive.ts`. Add the stage id there, and teach `stageForReminder` to select it, when that email is ready.

Tag ids resolve from the env var when it is set, otherwise from `GET /v4/tags` by name. The job does not create tags. If any of the five tags is missing, live mode writes nothing.

## Renewed swap

When `expiresAt` moves forward to more than 30 days out, live mode adds `Renewed` (`RENEWED_TAG_NAME`, `RENEWED_TAG_ID`) and removes `Renewal-Reminder` and every catch-up tag. A Kit rule should remove anyone tagged `Renewed` from the reminder sequence.

The Renewed tag is cleared at the start of the next cycle, not in the same run that adds it. The same run has to leave the tag in place so Kit's exit rule can see it. The next cycle starts the first day the new `expiresAt` is back inside the reminder window. Before the new reminder or catch-up tag is added, live mode calls Kit v4 remove-tag-from-subscriber: `DELETE /v4/tags/{tag_id}/subscribers/{subscriber_id}`. It does not call global unsubscribe, and it does not build that request for an unsubscribed, cancelled, bounced, or complained subscriber. The Redis set `renewal:renewed-present` records token ids that received Renewed. A dry run with Kit reads also treats current Renewed-tag subscribers as still tagged.

The open book is Redis set `renewal:open`. Members are dedupe keys from an earlier tag. Time passing out the back of the window is not a renewal, because `expiresAt` did not move forward. A new `expiresAt` that is still inside the window is treated as a new term, not a swap.

## Dedupe

After the tag calls succeed, the job writes `renewal:{tokenId}:{expiresAt}:{stage}` to Upstash and adds that key to the set `renewal:written`. Stages are `minus30`, `minus7`, `expiry`, `plus14`, and `renewed`. A stored `minus14` key is read as `minus7`. A later run that sees the same stage key does not tag that stage again. Any reminder or catch-up stage already written for the term also blocks the other reminder and catch-up stages, via `renewal:term:{tokenId}:{expiresAt}` or those written members. See "One stage per term". A failed tag does not write the key or the term marker, so the next run can retry. Kit returns 200 when the subscriber already has the tag.

## Hard exclusions

Live mode skips a person when any of these are true:

- Redis set `renewal:suppress`
- Redis set `renewal:exclude:first-run` (the Oct 2 triage list), and only when the next stage is -30 or -7. Expiry day and +14 are not held.
- Kit state `cancelled`, `unsubscribed`, `bounced`, or `complained`
- Kit state is anything other than `active`, including missing and inactive
- there is no numeric Kit subscriber id

The Kit tag `Citizens - renewal window Oct 2026` is not an exclusion. The job does not read it.

Tag writes use `POST /v4/tags/{tag_id}/subscribers/{subscriber_id}` and `DELETE /v4/tags/{tag_id}/subscribers/{subscriber_id}`. The subscriber must already exist. The code refuses to build that request for an opt-out state (`KitResubscribeBlocked`). It never calls `POST /v4/subscribers`, form subscribe, or sequence subscribe.

If `renewal:suppress` or `renewal:exclude:first-run` was not read, live mode writes nothing.

## Response

`GET` or `POST` `/api/cron/citizen-renewal-reminders` with bearer `CRON_SECRET`.

The JSON keeps the dry-run buckets. `writes.buckets` reports planned and executed counts for `renewalReminder`, `catchupMinus7`, `catchupExpiry`, `catchupPlus14`, `renewed`, and `typeformOnly`. Typeform-only planned and executed writes stay 0. `reported` is the count of those addresses. `writes.skipped` counts `deduped`, `alreadyStagedThisTerm`, `suppressed`, `firstRun`, `kitOptOut`, `noEmail`, `kitNotActive`, `noSubscriberId`, and `typeformOnly`. `writes.alreadyStagedThisTerm` lists each blocked term: token id, tag name already written, stage already written, and the stage that would have applied. Actions include a masked email (`a***@domain`) and never the raw address. `live` is true only when this request actually wrote.

Profiles are read from the MoonDAO Tableland gateway (`tableland.moondao.com`), not `tableland.network`. A non-JSON body from Tableland, Kit, or Typeform fails with a warning that names that source. A redirect is not followed.

Window positions, one per citizen:

| Position        | Meaning                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| enterToday      | Exactly 30 days left. Live mode adds `Renewal-Reminder` if the term has no stage.   |
| inside          | 1 to 29 days left. Late. Catch-up tag for the next email, if the term has no stage. |
| expiredWithin14 | Expiry day through 14 days after. Late. Catch-up tag, if the term has no stage.     |
| outOfWindow     | More than 30 days left, or more than 14 days past expiry.                            |

## Ops: load the Oct 2 list

Do not commit the CSV. From `ui/`:

```bash
yarn renewal:load-exclusions --csv /secure/oct2.csv --dry-run
yarn renewal:load-exclusions --csv /secure/oct2.csv
```

Dry run prints `count=<n>` and does not connect to Redis. The real run requires `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN`. It lowercases emails, dedupes them, and SADDs them into `renewal:exclude:first-run`. It prints `added=<n>` only.

The CSV may have a header column named `email`, `email_address`, or `email address`. Without that header, every cell that looks like an email is used.

## Ops: create the Kit tags

Create these tags in Kit before turning live mode on. Point each catch-up tag at a one-email automation. Point `Renewal-Reminder` at the four-email sequence. Point `Renewed` at a rule that removes the subscriber from that sequence.

- `Renewal-Reminder`
- `Renewal-Catchup-minus7`
- `Renewal-Catchup-expiry`
- `Renewal-Catchup-plus14`
- `Renewed`

Optional: set the matching `*_TAG_ID` env vars so the job does not depend on the name lookup.

## How to run it

GitHub Actions workflow `Citizen renewal coverage dry run` is manual and always calls `dryRun=1`.

Workflow `Citizen renewal reminders` is the only scheduler. It runs daily at 13:15 UTC and passes `live=1`. A manual run also passes `live=1` unless the `live` input is `0`, which stays a dry run. The server still ignores `live=1` until `RENEWAL_REMINDERS_LIVE` is exactly `true`. GitHub may start the 13:15 UTC schedule later than that minute.

The workflow calls `https://www.moondao.com` and does not follow redirects. The apex host returns 307, and curl does not treat that status as a failure. The job prints a short summary only: `live`, `dryRun`, `writing`, per-stage counts, writes executed, and failures. It does not print the raw response.

Both workflows use `CRON_SECRET` and `MOONDAO_SITE_URL`. The reminder route returns 503 when `CRON_SECRET` is unset.

Required on the host: `CRON_SECRET`, `TYPEFORM_PERSONAL_ACCESS_TOKEN`, the three `NEXT_PUBLIC_TYPEFORM_CITIZEN_*` form ids, and `CONVERT_KIT_V4_API_KEY` or `CONVERT_KIT_API_KEY`. Redis (`UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`) is required before any live write.

Chain reads use Arbitrum citizen `0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002`. Profiles come from Tableland `CITIZENTABLE_42161_126` (`formId` only, no email column).

## Later

- Server-side Kit subscribe at mint, with the token id on the subscriber, still without a form subscribe.
- Edit Profile and the email footer: "stop renewal reminders", which unsubscribes in Kit or adds `renewal:suppress`.
- Adding Typeform-only addresses with `POST /v4/subscribers`. That call stays described by `futureKitAddPlan` and is not executed.
