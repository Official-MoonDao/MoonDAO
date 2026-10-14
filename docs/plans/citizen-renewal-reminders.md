# Citizen renewal reminders

Dry run only. The route reads chain, Tableland, Typeform, Kit, and Redis. It does not tag, unsubscribe, create subscribers, or send email.

Reminders are on by default. A citizen with a findable email is in the reminder set unless they opted out. Opt-out is Kit's unsubscribe (state `cancelled`), a bounce or complaint, or the Redis set `renewal:suppress`. There is no opt-in checkbox. A later change can add a "stop renewal reminders" link in the email and on Edit Profile that writes one of those opt-outs. This pull request does not add that control.

## One tag, one sequence

Working tag name: `Renewal-Reminder`.

In a future live mode, the job adds that tag when a citizen is exactly 30 days from `expiresAt`. A Kit automation subscribes tagged people to one sequence. The sequence sends on day 0, day 16, day 30, and day 44 after entry. Those dates are 30 days before expiry, 14 days before expiry, expiry day, and 14 days after expiry.

Kit times a sequence from the day someone enters it. Tagging a person who is already inside the window would send the first email on the wrong date.

When `expiresAt` moves out of the window (they renewed), the future job adds a `Renewed` tag and removes `Renewal-Reminder`. A Kit rule removes anyone tagged `Renewed` from the sequence. That write is not in this pull request.

## Late entrants

The dry run marks anyone who is already inside the window, or expired within 14 days, as a late entrant. Each of those rows includes:

- `daysToExpiry` (negative once expiry day has passed)
- `sequence.sequenceDay`, which is `30 - daysToExpiry`
- `sequence.missedEmails` and `sequence.nextEmail`

Live mode should not put late entrants on `Renewal-Reminder`. Use a separate catch-up tag for the next email that is still due, or skip straight to that email, and leave the earlier emails unsent. Someone 20 days out has missed the -30 email and should next get the -14 email. Someone on expiry day should next get the expiry email. This pull request only reports that position.

## What the dry run returns

`GET` or `POST` `/api/cron/citizen-renewal-reminders`. Bearer `CRON_SECRET`, same header style as the contribution notifier. Omit `dryRun` or pass `dryRun=1`. Any other value is rejected.

Window position counts, one per citizen:

| Position | Meaning |
|---|---|
| enterToday | Exactly 30 days left. Live mode would add `Renewal-Reminder` today. |
| inside | 1 to 29 days left. Late if launched now. |
| expiredWithin14 | Expiry day through 14 days after. Late if launched now. |
| outOfWindow | More than 30 days left, or more than 14 days past expiry. |

Eligibility buckets, for people in the first three positions:

1. Active Kit subscriber.
2. Typeform email only, not in Kit. Later, add them with `POST https://api.kit.com/v4/subscribers` (`X-Kit-Api-Key`), body `{ email_address, state: "active", fields: { citizen_token_id } }`. Create the custom field first. Do not call form subscribe (`POST /v3/forms/{id}/subscribe` or `POST /v4/forms/{id}/subscribers`) or sequence subscribe. Those send the form incentive email and can start a welcome sequence. Docs: https://developers.kit.com/api-reference/subscribers/create-a-subscriber and https://developers.kit.com/api-reference/forms/bulk-add-subscribers-to-forms. Kit says this create endpoint does not change state for someone who already exists, so a cancelled subscriber stays cancelled. The code still refuses to plan that call when state is `cancelled`, `unsubscribed`, `bounced`, or `complained`.
3. Unsubscribed, cancelled, bounced, complained, inactive, or on `renewal:suppress`.
4. No email found.

Lookup uses `GET /v4/subscribers?email_address=...&status=all` so a cancelled subscriber is not mistaken for "not in Kit".

Dedupe key, not written yet: `renewal:{tokenId}:{expiresAt}`. One entry per citizen per term.

First-run exclusions stay outside the repo. Redis set `renewal:exclude:first-run` is the Oct 2 triage list (ops loads it). Kit tag id `RENEWAL_EXCLUSION_KIT_TAG_ID`, or a read-only lookup of the tag named `Citizens - renewal window Oct 2026 (tagged before 2025-11-29)`, is this week's broadcast audience. The report lists eligible rows that also sit on those lists. No email address is committed.

## How to run it

GitHub Actions workflow `Citizen renewal coverage dry run` is `workflow_dispatch` only. It prints the JSON to the job summary. Until this is merged, call a preview:

```bash
curl -fsS -X POST "https://<preview>/api/cron/citizen-renewal-reminders?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Accept: application/json"
```

Required on that host: `CRON_SECRET`, `TYPEFORM_PERSONAL_ACCESS_TOKEN`, the three `NEXT_PUBLIC_TYPEFORM_CITIZEN_*` form ids, and `CONVERT_KIT_V4_API_KEY` or `CONVERT_KIT_API_KEY`. Redis (`UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`) is needed for the suppression set and the Oct 2 list. Without Redis the report says those lists were not read.

Chain reads use Arbitrum citizen `0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002`. Profiles come from Tableland `CITIZENTABLE_42161_126` (`formId` only, no email column).

## Later, not this pull request

- Server-side Kit subscribe at mint, with the token id on the subscriber, still without a form subscribe.
- Edit Profile and the email footer: "stop renewal reminders", which unsubscribes in Kit or adds `renewal:suppress`.
- The live job that adds `Renewal-Reminder` on day -30, adds `Renewed` and removes `Renewal-Reminder` after a renewal, and handles late entrants with a catch-up tag.
