# DePrize jurisdictional controls

**Owner:** MoonDAO engineering (DePrize)  
**Review:** quarterly, or whenever Schedule A / Terms change  
**Last updated:** 2026-09-11

This document lists the controls that restrict new DePrize participation. It is
an operations record, not legal advice.

## Availability legend

> Not available to U.S. persons or anyone located in the United States or another restricted jurisdiction.

Use this exact sentence on DePrize pages, page metadata, legal documents, and
announcements. The source of truth in code is `DEPRIZE_AVAILABILITY_LEGEND` in
`ui/lib/deprize/constants.ts`.

## Controls and file owners

| Control | Owner | Source |
|---|---|---|
| Restricted-country list (Schedule A) | Engineering | `ui/lib/deprize/restrictedJurisdictions.ts` |
| Page country gate (`/deprize`, `/deprize/[id]`) | Engineering | `ui/lib/deprize/pageEligibility.ts` |
| Pre-bet eligibility decision | Engineering | `ui/lib/deprize/eligibility.ts`, `ui/lib/deprize/runEligibility.ts` |
| VPN / proxy / Tor / hosting / relay classification | Engineering | `ui/lib/deprize/vpnCheck.ts` |
| Sanctions screen | Engineering | `ui/lib/deprize/sanctions.ts` |
| Residency / entity / insider attestations | Engineering | `ui/lib/deprize/attestations.ts` |
| Acceptance and permit issuance records | Engineering | `ui/lib/deprize/acceptanceLog.ts`, `ui/lib/deprize/permitLog.ts` |
| Wallet observations and permanent deny list | Engineering | `ui/lib/deprize/walletObservations.ts` |
| Operator deny / allow | Engineering | `ui/scripts/deprize-wallet-deny.ts` (`yarn deprize:deny`) |
| Compliance export | Engineering | `ui/scripts/export-deprize-compliance-log.ts` (`yarn export:deprize-compliance`) |
| Circumvention alerts | Operations | `ui/lib/deprize/complianceAlerts.ts` |
| On-chain reconciliation | Operations | `ui/lib/deprize/runReconcile.ts`, `/api/cron/deprize-reconcile` |

Sell (`ExitPositionModal`) and redeem (`ClaimPanel`) are not gated by these
controls. They remain available so an existing holder can close or redeem a
position.

`/api/deprize/logs` is public chain data and is not country-gated.

## Failure behavior

| Failure | Result |
|---|---|
| Unknown or missing country header | DePrize pages show the location notice. New bets are refused. |
| Listed country or occupied Ukrainian region | Pages show the location notice. A screening request permanently denies the wallet for new participation. |
| Commercial VPN, proxy, Tor, or non-relay hosting | That request is refused. The wallet is not permanently denied. |
| Location-preserving relay (for example Apple Private Relay) | Allowed when the reported country is known and not listed. |
| Redis, VPN provider, or sanctions provider outage | New bets are refused (`screening-unavailable`). The system does not fail open. |
| Permit-record write failure | No signature is returned (HTTP 503). |
| `CRON_SECRET` unset in production | `/api/cron/deprize-reconcile` returns 503 and does not run. |
| Reconciliation fetch or alert-delivery failure | The block cursor is not advanced. The next scheduled run retries the same range. |
| Compliance webhook failure during eligibility | Eligibility is unchanged. The denial is still stored. Reconciliation can re-report related on-chain activity. |

Raw IP addresses are not stored or logged. Records keep an IP hash only.

## Alerts

Recipient: the channel configured as `DEPRIZE_COMPLIANCE_WEBHOOK_URL`
(typically an operations Discord webhook).

The job posts when:

- a new permanent wallet denial is created;
- an on-chain `Bet` has no matching permit issuance record;
- a non-`DePrizeMint` LMSR trade has a positive outcome amount (`direct-buy-review-required`);
- the reconciliation job itself fails.

On-chain data has no IP. A `direct-buy-review-required` alert is a review
signal, not a finding that the transactor is a U.S. person.

## Quarterly review

Each quarter, or sooner if Terms or Schedule A change, engineering and
operations confirm:

1. `restrictedJurisdictions.ts` still matches the published Schedule A.
2. Attestation copy and `DEPRIZE_TERMS_VERSION` match the published Terms.
3. `DEPRIZE_COMPLIANCE_WEBHOOK_URL` still reaches the intended operators.
4. On-chain `DePrizeMint.complianceSigner()` equals the address derived from
   `DEPRIZE_COMPLIANCE_SIGNER_KEY`.
5. The reconciliation cursor is advancing and the GitHub Actions workflow is
   green.
6. The monthly archive owner and destination below are still correct.

## Monthly archive

```
yarn export:deprize-compliance
```

The script writes newline-delimited JSON to stdout and refuses to print raw
IPs, Redis tokens, or private keys. Redirect the output to the destination
below. Retention target is five years.

| Field | Value |
|---|---|
| Archive owner | Assign a named person before production open |
| Archive destination | Assign the encrypted store / counsel-designated location before production open |

## Production open checklist

Do not open DePrize to the public until every item is complete.

- [ ] Counsel approved the Terms, attestations, privacy and retention language, country list, and sell/redemption policy
- [ ] `NEXT_PUBLIC_ENV=prod`
- [ ] `DEPRIZE_ELIGIBILITY_BYPASS` is unset
- [ ] Upstash Redis credentials are configured
- [ ] VPN provider credentials are configured and tested
- [ ] `DEPRIZE_COMPLIANCE_WEBHOOK_URL` is configured
- [ ] `CRON_SECRET` is configured
- [ ] `DEPRIZE_RECONCILE_START_BLOCK` is configured
- [ ] On-chain `DePrizeMint.complianceSigner()` equals `complianceSignerAddress()` from `DEPRIZE_COMPLIANCE_SIGNER_KEY`
- [ ] A production-edge request shows `x-vercel-forwarded-for`, `x-vercel-ip-country`, and `x-vercel-ip-country-region`
- [ ] Reconciliation has run successfully once
- [ ] Monthly archive owner: ________________
- [ ] Monthly archive destination: ________________
