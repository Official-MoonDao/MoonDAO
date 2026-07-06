# Frank Raise Re-Open — Deploy Plan

*Arbitrum One · JB Project 73 · Target: Thursday July 9, 2026*

---

## Live on-chain state (as of July 2, 2026)

| Field | Value |
|---|---|
| **JB Project ID** | 73 |
| **Chain** | Arbitrum One (42161) |
| **Project Safe** | `0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA` |
| **Safe signers / threshold** | 5 signers, **3-of-5** required |
| **Terminal balance** | **26.743 ETH ≈ $44,500** (nothing spent) |
| **Total token supply** | 53,487 `$OVERVIEW` (18 decimals) |
| **Active ruleset** | 3 (payouts ruleset, started Apr 29 2026) |
| **Active ruleset duration** | 0 → lasts until the next ruleset is queued |
| **Active approvalHook** | `0x0` → **any queued ruleset takes effect immediately** |
| **pausePay** | false (terminal accepts payments but hook may gate them) |
| **useDataHookForCashOut** | false (no refunds available from current ruleset) |
| **JB Controller** | `0x27da30646502e2f642bE5281322Ae8C394F7668a` |
| **JB Terminal** | `0x2dB6d704058E552DeFE415753465df8dF0361846` |
| **JB Rulesets** | `0x6292281D69c3593FCF6eA074E5797341476ab428` |
| **JB Terminal Store** | `0xfE33B439Ec53748C87DcEDACb83f05aDd5014744` |
| **JB Tokens** | `0x4d0Edd347FB1fA21589C1E109B3474924BE87636` |
| **MoonDAO Treasury** | `0xAF26a002d716508b7e375f1f620338442F5470c0` |

### Token distribution (current)
- 26,744 contributor `$OVERVIEW` (original 1,000/ETH rate)
- 26,744 reserved `$OVERVIEW` (50% split between vesting contracts and pool deployer)

### Refund model: exact ETH back (deposit ledger)
`ReopenPayHook` refunds every backer **exactly the ETH they contributed**, regardless of the rate they minted at. It does **not** split the pot pro-rata by tokens (which would over-pay 1,000/ETH backers and under-pay 500/ETH backers for the same ETH).

- **New (re-open) contributions** are recorded live: a pay hook credits `ethContributed[beneficiary] += amount` on every `pay`.
- **Original contributions** are seeded once from the historical `Pay` events (Pre-step B). The resolver script sums each beneficiary's exact ETH in — verified to total **26.743426 ETH across 94 contributors**, matching the terminal balance to the wei.
- On refund, the hook returns a synthetic `totalSupply` so the terminal's `surplus × cashOutCount / totalSupply` formula resolves to the caller's remaining ETH, scaled by the fraction of tokens burned. A cash-out hook decrements the ledger so partial/repeat refunds stay exact.
- Reserved holders (vesting, pool deployer) contributed no ETH → `ethContributed = 0` and are additionally blocked from cashing out.

**Caveat:** the ledger keys off ETH paid, not tokens held. Post-reopen token transfers would desync a claim from its tokens, so the ruleset sets `pauseCreditTransfers = true`. (Pre-reopen transfers are already handled because seeding credits whoever holds the tokens' contribution history via the original Pay events.)

### Key finding: MissionCreator mapping gap (resolved)
`MissionCreator.missionIdToPayHook(4)` returns `0x0` on the current `0x87e80c0d...` MissionCreator. The Frank mission was created via an older MissionCreator (`0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593`). The vesting and pool deployer addresses have been resolved from the original creation event (Pre-step A below) and are hardcoded into the deploy commands.

---

## Pre-steps (before the Safe transaction)

### Pre-step A — Vesting and pool deployer addresses ✅ RESOLVED

These were read directly from the `SetSplit` events in the original mission creation transaction:

**Tx:** `0xb674a3df953b583b3ba6bc06f8c282e3344d560a96e6d8de7a7effc44e5824c1` (block 440,809,003)

**How the original MissionCreator was found:**
```bash
# Project 73 NFT mint → tokenId=0x49 transfer from 0x0
cast logs \
  --address 0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4 \
  --from-block 0x1a0575ff \
  "Transfer(address indexed,address indexed,uint256 indexed)" \
  "" "" "$(printf '0x%064x' 73)" \
  --rpc-url https://arb1.arbitrum.io/rpc
# → creation tx hash above, MissionCreator = 0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593
```

**Resolved addresses (all confirmed on-chain):**

| Role | Address | Used in |
|---|---|---|
| **teamVesting** | `0x02430cc8e6932850a08d0c8820437a3229d8d6eb` | Reserved token split (34.85%) |
| **moonDAOVesting** | `0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8` | Reserved token split (59.98%) |
| **poolDeployer** | `0x95fc39dd278b8dcd7b0219d6e109717d8e539114` | Reserved token split (5.0%) + ETH payout split (5.13%) |
| MoonDAO Treasury | `0xAF26a002d716508b7e375f1f620338442F5470c0` | ETH payout split (2.56%) |
| Safe (team direct) | `0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA` | ETH payout split (92.28%) |

**`ReopenPayHook` `reservedHolders` array** (3 addresses that receive reserved `$OVERVIEW`):
```
reservedHolders[0] = 0x02430cc8e6932850a08d0c8820437a3229d8d6eb  // teamVesting
reservedHolders[1] = 0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8  // moonDAOVesting
reservedHolders[2] = 0x95fc39dd278b8dcd7b0219d6e109717d8e539114  // poolDeployer
```

> **Note:** The original `MissionCreator` used for this mission is `0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593` (not the current `0x87e80c0d...`). That is why `missionIdToPayHook(4)` returned `0x0` on the current MissionCreator.

**Original LaunchPadPayHook** (old, replaced by `ReopenPayHook`): `0xf491c385945f0df7557c25e7eec011c925ad1a35`

### Pre-step B — Resolve original contributions for the deposit-ledger seed

Only needed if original backers should be refundable in a wind-down (they are, per the refund model above). Reconstruct each original contributor's exact ETH from the historical `Pay` events:

```bash
cd subscription-contracts
HOOK=<ReopenPayHook address from Transaction 1> \
  node script/backfill/resolve-contributions.mjs
```

This:
- Scans every `Pay` event for project 73, sums ETH per beneficiary, excludes the 3 reserved holders.
- Prints a per-contributor table and the **total (must equal ~26.7433 ETH — sanity check against the terminal balance)**.
- Writes `script/backfill/frank-contributions.json`.
- Prints `seedContributions(address[],uint256[])` calldata batches + the `lockLedger()` calldata for the Safe Transaction Builder.

The current result: **94 contributors, 26.743426 ETH total** (matches the pot exactly).

---

## Transaction sequence

### Transaction 1 — Deploy `ReopenPayHook` (any EOA, no Safe required)

**Who:** Any operator key (e.g. `pmoncada.eth`). Does not need to be the Safe.

**What:** Deploys a new `ReopenPayHook` owned by the project Safe.

```bash
cd subscription-contracts

export PRIVATE_KEY=<operator key>       # any EOA, pays gas
export MISSION_ID=4
export MISSION_CREATOR_ADDRESS=0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593  # the original MissionCreator

# Vesting/pool addresses resolved from the creation tx (Pre-step A)
export TEAM_VESTING=0x02430cc8e6932850a08d0c8820437a3229d8d6eb
export MOONDAO_VESTING=0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8
export POOL_DEPLOYER=0x95fc39dd278b8dcd7b0219d6e109717d8e539114
export TERMINAL=0x2dB6d704058E552DeFE415753465df8dF0361846
export FUNDING_GOAL=965095584468733657088   # original goal in wei
export TOKENS_PER_ETH=500

forge script script/QueueReopenRuleset.s.sol \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --broadcast --via-ir \
  -vvv
```

**Note the deployed hook address.** You'll need it for Transaction 2.

**Gas estimate:** ~800K gas ≈ $0.10 on Arbitrum.

---

### Transaction 2 — Seed ledger + lock + queue ruleset (Safe, 3-of-5)

**Who:** Project Safe `0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA` — requires 3 of 5 signers.

**What:** A single **Transaction Builder batch** (atomic multisend) with these actions in order:

1. `ReopenPayHook.seedContributions(holders, amounts)` — one or more batches (calldata from Pre-step B). **To:** the hook address, **Value:** 0.
2. `ReopenPayHook.lockLedger()` — freezes the seed. **To:** the hook, **Value:** 0.
3. `JBController.queueRulesetsOf(...)` — activates the re-open ruleset (calldata from Option A below). **To:** `0x27da30646502e2f642bE5281322Ae8C394F7668a`, **Value:** 0.

Doing all three in one batch guarantees the ledger is seeded and frozen **before** the ruleset goes live, so no contribution can slip in against an unseeded ledger. Because the current ruleset has `duration=0` and `approvalHook=0x0`, the new ruleset takes effect **immediately** on the next terminal interaction.

> If original backers are **not** being made refundable, skip actions 1–2 and do only the `queueRulesetsOf` call.

#### Option A — Use the script to generate the queueRulesetsOf calldata (recommended)

```bash
cd subscription-contracts

# This prints the encoded calldata without broadcasting.
# Paste the output into the Safe Transaction Builder.
export PRIVATE_KEY=<any key, just for dry run>
export MISSION_ID=4
export MISSION_CREATOR_ADDRESS=0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593
export TEAM_VESTING=0x02430cc8e6932850a08d0c8820437a3229d8d6eb
export MOONDAO_VESTING=0x2f696b8102ce1214f7dfffe4f3c99684e13fc5b8
export POOL_DEPLOYER=0x95fc39dd278b8dcd7b0219d6e109717d8e539114
export TERMINAL=0x2dB6d704058E552DeFE415753465df8dF0361846
export FUNDING_GOAL=965095584468733657088
export TOKENS_PER_ETH=500

forge script script/QueueReopenRuleset.s.sol \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --via-ir \
  -vvv
# (no --broadcast — default mode prints calldata for the Safe)
```

Copy the printed calldata and:
1. Go to [app.safe.global](https://app.safe.global) → `0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA`
2. New Transaction → **Transaction Builder**
3. Add the Pre-step B actions first (seedContributions batches → lockLedger, **To:** the hook address), then add this final action:
   - **To:** `0x27da30646502e2f642bE5281322Ae8C394F7668a` (JB Controller)
   - **Value:** 0
   - **Data:** paste the `queueRulesetsOf` calldata
4. Collect 3 signatures and execute the batch.

#### Option B — Build the transaction manually in Safe Transaction Builder

If the script path is blocked (MissionCreator mappings still 0), use the Transaction Builder directly with ABI-encoded calldata. The call is:

```
JBController.queueRulesetsOf(
  uint256 projectId,                    // 73
  JBRulesetConfig[] memory configs,     // [one config — see below]
  string memory memo                    // "Re-opening Launchpad at 500 $OVERVIEW/ETH"
)
```

**JBRulesetConfig for the re-open:**

```
mustStartAtOrAfter: 0
duration:           0              (lasts until next ruleset)
weight:             1000000000000000000000  (500/ETH contributor + 50% reserved)
weightCutPercent:   0              (no automatic decay)
approvalHook:       0x0000000000000000000000000000000000000000

metadata:
  reservedPercent:        5000   (50%)
  cashOutTaxRate:         0
  baseCurrency:           61166  (ETH)
  pausePay:               false  (contributions open)
  pauseCreditTransfers:   true   (keeps token holdings aligned with refund claims)
  allowOwnerMinting:      false
  allowSetCustomToken:    false
  allowTerminalMigration: false
  allowSetTerminals:      false
  allowSetController:     false
  allowAddAccountingContext: false
  allowAddPriceFeed:      false
  ownerMustSendPayouts:   true
  holdFees:               false
  useTotalSurplusForCashOuts: false
  useDataHookForPay:      true
  useDataHookForCashOut:  true
  dataHook:               <ReopenPayHook address from Transaction 1>
  metadata:               0

fundAccessLimitGroups:
  terminal:     0x2dB6d704058E552DeFE415753465df8dF0361846
  token:        0x000000000000000000000000000000000000EEEe
  payoutLimits: []           (payouts locked during the raise)
  surplusAllowances:
    amount:   128000000000000000000000000   (128M ETH, functionally unlimited)
    currency: 0x000000000000000000000000EEEe0000 (low 32 bits of native token)

splitGroups: [ETH payout splits, reserved token splits]
  — See Pre-step A for beneficiary addresses.
  — If using option 3 (Safe as placeholder), set all beneficiaries to the Safe.
```

**Gas estimate:** ~600K gas ≈ $0.08 on Arbitrum.

---

## After Transaction 2 — verify on-chain

```bash
RPC=https://arb1.arbitrum.io/rpc
PROJECT_ID=73

# 1. Confirm the new ruleset is active (should show new weight and your hook address)
cast call 0x6292281D69c3593FCF6eA074E5797341476ab428 \
  "currentOf(uint256)((uint256,uint256,uint256,uint256,uint256,uint112,uint256,address,uint256))" \
  $PROJECT_ID --rpc-url $RPC

# 2. Confirm the hook is in stage 1 (active funding)
NEW_HOOK=<deployed address>
cast call $NEW_HOOK \
  "stage(address,uint256)(uint256)" \
  0x2dB6d704058E552DeFE415753465df8dF0361846 $PROJECT_ID \
  --rpc-url $RPC
# Expected: 1

# 3. Confirm a contribution goes through (test with a small amount)
cast send --private-key <test key> \
  0x2dB6d704058E552DeFE415753465df8dF0361846 \
  "pay(uint256,address,uint256,address,uint256,string,bytes)" \
  $PROJECT_ID \
  0x000000000000000000000000000000000000EEEe \
  0 0xYourAddress 0 "test" 0x \
  --value 0.001ether \
  --rpc-url $RPC

# 4. Check token balance for the test address (should be 0.001 * 500 = 0.5 $OVERVIEW)
cast call 0x27da30646502e2f642bE5281322Ae8C394F7668a \
  "totalTokenSupplyWithReservedTokensOf(uint256)(uint256)" \
  $PROJECT_ID --rpc-url $RPC
```

---

## Rate update procedure (future)

To step the rate down (e.g. from 500 → 250/ETH after month 1), the Safe queues another ruleset with `weight = 500e18` (250 contributor × 2). Since the re-open ruleset has `approvalHook = 0x0`, the new ruleset takes effect immediately when queued — no waiting.

Re-run the script with `TOKENS_PER_ETH=250` or propose a new Transaction Builder tx with `weight=500000000000000000000`.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Split beneficiary addresses** | ✅ Resolved — all 3 reserved-token split addresses read from the original creation tx. Hardcoded into the deploy commands above. |
| **Mixed-rate refund if campaign fails** | `ReopenPayHook` refunds each backer the **exact ETH they contributed** via a deposit ledger (new contributions tracked live; originals seeded from Pay events). Order-independent, pot clears exactly, no one gets more or less than they paid. |
| **Ledger desync from token transfers** | Ruleset sets `pauseCreditTransfers = true`; seed is frozen with `lockLedger()` in the same Safe batch as the ruleset activation. |
| **Seed accuracy** | Resolver totals must equal the terminal balance (26.7433 ETH) before seeding — a built-in sanity check. Seeding is owner-gated and rejects reserved holders. |
| **Contributions rejected before tx2 executes** | The current ruleset has `useDataHookForPay=true` and the original hook; the hook's deadline may have already passed, causing the revert "deadline has passed". This is expected and fine — the re-open ruleset fixes this the moment it activates. |
| **3-of-5 signer coordination** | Line up all five signers before launch day. The Safe tx can be proposed and signed in advance; it only executes when the threshold is reached. Propose it Tuesday July 7 so Wednesday July 8 is a buffer. |
| **No approval hook on re-open ruleset** | By design — required for manual rate steps. Payouts remain locked (no payout limits). The Safe is the only entity that can move funds. |

---

## Safe signers (for coordination)

| Address | Name |
|---|---|
| `0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801` | (signer 1) |
| `0xdAe44f2b119f1b975d001C51E928B375383a6728` | (signer 2) |
| `0xf2Befa4B9489c1ef75E069D16A6F829F71B4B988` | Frank |
| `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` | ryand2d.eth |
| `0x679d87D8640e66778c3419D164998E720D7495f6` | pmoncada.eth |

Need any **3** of the above to execute Transaction 2.

---

*Derived from live Arbitrum mainnet state. All addresses verified on-chain July 2, 2026.*
*PR: github.com/Official-MoonDao/MoonDAO/pull/1426*
