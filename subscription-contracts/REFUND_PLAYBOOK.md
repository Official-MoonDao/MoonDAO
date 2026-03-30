# Manual Refund Playbook

Use this guide when a mission has **not met its funding goal** and was launched with refunds disabled, but you want to enable refunds for contributors.

---

## How It Works

Juicebox V5 uses *rulesets*. Each ruleset has a `dataHook` (the `LaunchPadPayHook`) that controls the mission stage. When a mission launches with refunds disabled, the original PayHook has `refundsEnabled = false` and `refundPeriod = 0`, so `stage()` returns **4** (closed) after the deadline.

To enable refunds, you queue a **new ruleset** with:
- A new `LaunchPadPayHook` with `refundsEnabled = true` and a `refundPeriod` (e.g. 28 days)
- A new `LaunchPadApprovalHook` with `refundsEnabled = true` (keeps the ruleset locked in refund state)

Once the new ruleset activates, contributors can redeem their tokens for a proportional ETH refund via the mission page.

---

## Prerequisites

| Item | Notes |
|---|---|
| Foundry installed | `curl -L https://foundry.paradigm.xyz \| bash` |
| Project's Gnosis Safe | Must own the Juicebox project NFT |
| Signer key on the Safe | `PRIVATE_KEY` env var |
| Mission ID + Project ID | Found in Tableland / the mission URL |

---

## Step 1 — Get Mission Info

From the mission URL (`/mission/<tokenId>`), you need:

```bash
# MissionCreator address (from const/config.ts)
MISSION_CREATOR=0x...

# Get the projectId for this mission token
cast call $MISSION_CREATOR "missionIdToProjectId(uint256)(uint256)" <tokenId> --rpc-url $RPC_URL

# Get the team Safe (owns the JB project NFT)
cast call $JB_PROJECTS "ownerOf(uint256)(address)" <projectId> --rpc-url $RPC_URL
```

---

## Step 2 — Run the Refund Script

### Option A: Gnosis Safe (multi-sig) — use Safe UI

1. Generate the `queueRulesetsOf` calldata by dry-running the script:

```bash
cd subscription-contracts

forge script script/QueueRefundRuleset.s.sol \
  --sig "run(uint256,uint256,address,uint256)" \
  <missionTokenId> <projectId> <teamSafeAddress> <refundPeriodSeconds> \
  --rpc-url $RPC_URL \
  --via-ir \
  -vvv
```

2. Copy the encoded calldata from the output.
3. Go to [app.safe.global](https://app.safe.global), open the team's Safe.
4. **New Transaction → Transaction Builder**
   - **To:** JB Controller address (see `JBV5_CONTROLLER_ADDRESS` in `const/config.ts`)
   - **Data:** paste the calldata
5. Collect signatures from other signers and execute.

### Option B: 1/1 Safe (single signer) — run directly

```bash
cd subscription-contracts

forge script script/QueueRefundViaExec.s.sol \
  --sig "run(uint256,uint256,address)" \
  <missionTokenId> <projectId> <teamSafeAddress> \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --via-ir \
  -vvv
```

This deploys the new hooks and executes `queueRulesetsOf` through the Safe in a single transaction.

---

## Step 3 — Wait for Ruleset to Activate

The new ruleset activates when the **current ruleset expires**. If the original ruleset had a fixed duration, you wait for it. If `duration = 0`, it activates immediately on the next interaction.

Verify activation:

```bash
cast call $JB_CONTROLLER "currentRulesetOf(uint256)" <projectId> --rpc-url $RPC_URL
```

The returned metadata should show your new PayHook address as `dataHook`.

---

## Step 4 — Verify On-Chain

```bash
NEW_PAY_HOOK=<address from script output>

# Should return 3 (refundable)
cast call $NEW_PAY_HOOK "stage(address,uint256)(uint8)" $JB_TERMINAL <projectId> --rpc-url $RPC_URL

# Should return true
cast call $NEW_PAY_HOOK "refundsEnabled()(bool)" --rpc-url $RPC_URL
```

---

## Step 5 — UI

Once the ruleset is active, the mission page will automatically show a **Redeem** button to contributors who hold tokens. No UI changes needed — the UI reads stage from the active ruleset's `dataHook`.

The refund window stays open for `refundPeriod` seconds (default: 28 days = 2,419,200 seconds).

---

## Key Addresses (Arbitrum Mainnet)

| Contract | Address |
|---|---|
| JB Controller | See `JBV5_CONTROLLER_ADDRESS` in `ui/const/config.ts` |
| JB Terminal | See `JBV5_TERMINAL_ADDRESS` in `ui/const/config.ts` |
| MissionCreator | See `MISSION_CREATOR_ADDRESSES` in `ui/const/config.ts` |

---

## Troubleshooting

**"must wear ManagerHat"** — the script signer must own the Hats Protocol manager hat for the team, OR be a signer on the team Safe that owns the project NFT.

**Stage still shows 4 after activation** — hard reload the mission page (SSR cache). If it persists, check that the new ruleset is actually active with `currentRulesetOf`.

**Redeem button not visible** — user must be signed in with a wallet that holds tokens for the project. The button only appears when `tokenBalance > 0 || tokenCredit > 0`.
