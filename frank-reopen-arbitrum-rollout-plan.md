# Frank Re-open — Arbitrum Rollout Plan

Re-opening fundraising on the "Send Frank to Space" mission (mission id **4**, Juicebox
**project 73**) on Arbitrum, at a new **500 $OVERVIEW/ETH** issuance rate, without
disturbing the original backers and while keeping every contribution refundable.

This plan is **executable**, not just descriptive. Track A is backed by an
assertion-driven Foundry harness that runs against a fork of live Arbitrum and drives
the real project with its real contributor set and real owner Safe.

---

## What we are changing

- A new `ReopenPayHook` (deposit-ledger refund model) replaces the original
  `LaunchPadPayHook` as the mission's data hook.
- A new ruleset re-opens contributions at 500/ETH (ruleset weight = `500 * 2 * 1e18`
  because 50% of every mint is reserved), no decay, no approval hook.
- Original balances are untouched; payouts stay locked (no payout limit); the surplus
  allowance is permissioned to the owner Safe only.
- The deposit ledger is seeded with every original backer (net ETH + net tokens) from
  `subscription-contracts/script/backfill/frank-contributions.json`, then frozen with
  `lockLedger()` in the same Safe batch that goes live.

---

## Track A — Fork dry run (engineering gate)

Prove the exact production sequence against **live Arbitrum state** before touching
anything. Nothing is broadcast — it forks the chain, impersonates the real owner Safe,
and simulates every step with assertions.

**Artifacts**
- `subscription-contracts/test/ReopenFrankArbitrumDryRun.t.sol` — the harness.
- `subscription-contracts/script/dry-run-reopen-arbitrum.sh` — the runner.

**Run it**
```bash
cd subscription-contracts
export ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/<key>   # archive node
./script/dry-run-reopen-arbitrum.sh
# or:
forge test --match-contract ReopenFrankArbitrumDryRun -vvv --fork-url $ARBITRUM_RPC_URL
```

**What the harness asserts (all currently PASSING against live Arbitrum):**
1. Project 73 is in its real state: ~26.74 ETH parked in the terminal, below goal.
2. The real owner Safe deploys `ReopenPayHook`, seeds all 94 original backers, and
   locks the ledger.
3. The Safe queues the re-open ruleset and resets the deadline; the ruleset goes live
   immediately (weight = 500/ETH rate, no decay, no approval hook).
4. A fresh 1 ETH contribution mints exactly 500 tokens; original balances unchanged.
5. After the new deadline, the new backer reclaims **exactly 1 ETH**, and a real
   original backer (the 11.966 ETH whale) reclaims their **exact** contribution.
6. A non-owner cannot drain the surplus (`useAllowanceOf`) or trigger payouts.

All parameters are env-overridable (`PROJECT_ID`, `FUNDING_GOAL`, `TOKENS_PER_ETH`,
`CAMPAIGN_DURATION_DAYS`, `FORK_BLOCK`, vesting/terminal addresses, …), so the same
harness validates future rate step-downs or other re-opened missions.

---

## Track B — UI preview against a fork (stakeholder gate)

Let non-engineers click through the re-opened mission page end to end before go-live.

1. Stand up a shareable fork of Arbitrum (Tenderly Virtual TestNet is easiest; it
   gives a persistent hosted RPC and a block explorer).
2. Execute the Track A sequence against that fork's RPC (point the runner at it via
   `ARBITRUM_RPC_URL`, or run the equivalent broadcast against the Tenderly RPC) so
   the fork carries the live re-open ruleset.
3. Deploy a Vercel preview of `ui/` with `NEXT_PUBLIC_ARBITRUM_RPC_URL` set to the
   fork RPC. The one-line override in `ui/lib/rpc/chains.ts` makes the whole app read
   and write against the fork with no other changes.
4. Share the private preview link. Stakeholders can contribute test ETH, watch the
   funding bar move, and (after advancing the fork clock) confirm refunds — all
   without touching mainnet. `useMissionData` is already re-open aware and reads the
   stage from the new data hook, so the page shows the correct state.

---

## Reversibility ("no one-way door")

The team Safe owns the project NFT and can queue a new ruleset at any time (the
re-open ruleset has no approval hook), so we can always:
- change the rate, unlock payouts, or open refunds by queuing another ruleset;
- reuse the **same** `ReopenPayHook` on a rate update to preserve the deposit ledger.

The only irreversible action is spending funds out of the surplus allowance — a
governance action gated to the owner Safe. Track A's second test proves a non-owner
cannot do it. To harden further, the surplus allowance can be zeroed in the re-open
ruleset (optional; see `QueueReopenRuleset.s.sol`).

---

## Go-live checklist (mainnet, via the team Safe)

1. Re-run Track A at the intended `FORK_BLOCK` — confirm green.
2. Deploy `ReopenPayHook` (EOA or Safe) with the production goal/deadline/refund.
3. In one Safe batch:
   - `seedContributions(...)` for every original backer (from the backfill JSON),
   - `lockLedger()`,
   - `queueRulesetsOf(...)` for the re-open ruleset (calldata from
     `QueueReopenRuleset.s.sol`),
   - `setDeadline(now + campaign)` on the hook to reset the countdown to go-live.
4. Verify the active ruleset weight, that a small test contribution mints at 500/ETH,
   and that the mission page reflects the re-open.
