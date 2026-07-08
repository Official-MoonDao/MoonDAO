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

## Track B — UI testing (stakeholder gate)

Two Tenderly-free ways to exercise the re-open through the real UI. Option A is the
faithful engineering check (real project 73, local/private); Option B is the public,
shareable stakeholder demo (synthetic mission on Sepolia).

The UI needs no code changes beyond the one-line override already in
`ui/lib/rpc/chains.ts`: `NEXT_PUBLIC_ARBITRUM_RPC_URL` overrides the Arbitrum RPC, and
`useMissionData` is already re-open aware (if `MissionCreator.stage()` is 4 but the
active ruleset's data hook differs, it reads stage from `ReopenPayHook`).

### Option A — Local `anvil` fork of real Arbitrum (faithful, private)

Forks live Arbitrum locally, broadcasts the exact re-open onto it (impersonating the
real owner Safe), and points a local UI dev server at it. Uses the **real** project 73,
pot, and 94-backer set. **Validated end-to-end** — 8 real txns broadcast, hook stage
= 1, ledger locked, whale `ethContributed` = 11.966 ETH.

**Artifacts**
- `subscription-contracts/script/start-arbitrum-fork.sh` — starts the anvil fork.
- `subscription-contracts/script/run-reopen-on-fork.sh` — broadcasts the re-open.
- `subscription-contracts/script/SetupReopenOnFork.s.sol` — the broadcast script.

```bash
# Terminal A — start the fork (leave running):
cd subscription-contracts
export ARBITRUM_RPC_URL=https://arbitrum-mainnet.infura.io/v3/<key>
./script/start-arbitrum-fork.sh

# Terminal B — broadcast the re-open onto the fork:
cd subscription-contracts
./script/run-reopen-on-fork.sh

# Terminal C — point the UI at the fork and open /mission/4:
cd ui
NEXT_PUBLIC_CHAIN=mainnet NEXT_PUBLIC_ARBITRUM_RPC_URL=http://localhost:8545 yarn dev
```

- **Contribute in the UI:** add a network to your wallet with RPC `http://localhost:8545`
  and chain id `42161`; anvil pre-funds test accounts, or use
  `cast rpc anvil_setBalance <addr> <hex-wei>` to fund your address. Revert the wallet
  network afterward.
- **Share it:** local only. To show others, screen-share or expose `localhost:3000`
  with a temporary tunnel (`cloudflared tunnel --url http://localhost:3000`).

### Option B — Public Sepolia recreation (shareable, synthetic)

Creates a Frank-like mission on the public Sepolia testnet (JB v5 lives there at the
same addresses), lets the original round lapse, then re-opens it. Anyone can connect a
wallet, get faucet ETH, and click through a normal Vercel testnet preview link.
Because a public chain's clock can't be fast-forwarded, the test mission uses SHORT
durations (default 10-min deadline + 10-min refund) so it lapses in real time.

**Artifacts**
- `subscription-contracts/script/CreateTestMissionSepolia.s.sol` — creates the mission.
- `subscription-contracts/script/QueueReopenRuleset.s.sol` — re-opens it (existing).

```bash
cd subscription-contracts
export PRIVATE_KEY=0x...            # MissionCreator owner or team manager on Sepolia
export SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<key>

# 1. Create a short-lived test mission (+ a small seed contribution):
forge script script/CreateTestMissionSepolia.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir -vvv
#    -> note the printed MISSION_ID, TERMINAL, TEAM_VESTING, MOONDAO_VESTING, POOL_DEPLOYER

# 2. Wait for the deadline + refund window to elapse (~20 min with defaults).

# 3. Re-open it at 500/ETH (queue directly since the EOA owns the project):
MISSION_ID=<printed> MISSION_CREATOR_ADDRESS=<sepolia MissionCreator> \
  QUEUE_VIA_SENDER=true TOKENS_PER_ETH=500 \
  CAMPAIGN_DURATION_DAYS=1 REFUND_PERIOD_DAYS=1 \
  TEAM_VESTING=<printed> MOONDAO_VESTING=<printed> POOL_DEPLOYER=<printed> TERMINAL=<printed> \
  forge script script/QueueReopenRuleset.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --via-ir
```

Then deploy a normal Vercel **testnet** preview of `ui/` (`NEXT_PUBLIC_CHAIN` unset /
testnet, `NEXT_PUBLIC_TEST_CHAIN=sepolia`), enable Deployment Protection for a private
link, and open `/mission/<MISSION_ID>`. Stakeholders use real Sepolia wallets + faucet
ETH — no RPC override or wallet hacks needed.

| | Option A (anvil fork) | Option B (Sepolia) |
|---|---|---|
| Real project 73 + backers | ✅ | ❌ (synthetic) |
| Shareable public link | ❌ (local/tunnel) | ✅ |
| Wallet setup for testers | custom localhost network | none (real Sepolia) |
| Time control for refunds | instant (`evm_increaseTime`) | must wait real minutes |

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
