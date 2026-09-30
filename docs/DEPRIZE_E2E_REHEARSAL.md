# DePrize Sepolia dress rehearsal

Script for Miguel. Pablo and Ryan sign and bet. This is the run to follow.
Calldata for the same Safe transactions is also in
[`DEPRIZE_TOUCHDOWN_V2_REHEARSAL.md`](./DEPRIZE_TOUCHDOWN_V2_REHEARSAL.md).
Where the two files disagree, follow this one.

Two prizes:

1. **Success.** Sepolia DePrize **#7** (Touchdown v2) already exists. Two wallets
   bet two different competitors. ispace wins. The winning bettor claims from
   the market. The Juicebox surplus is sent to a chosen winner address. A
   separate amount is sent to the Sepolia mission treasury. The pool deployer
   is funded with ETH and project tokens, then `createAndAddLiquidity` runs.
2. **Failure.** Sepolia DePrize **#8** is already open. Two wallets bet. The
   prize is brought to the no-winner refund. Both bettors claim from the
   market, and both cash the Juicebox slice back out. A literal `cancel()`
   cannot finish the same day. That path is spelled out below.

Do not resolve #7 as the failure case. `reportPayouts` can be sent once.

Chain state checked 2026-09-30, after the failure prize was provisioned:

| Check | Value |
|---|---|
| Registry owner | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` (deployer) |
| Registry pending owner | the Safe below |
| DePrize #7 `state` | `2` (OPEN), betting open |
| DePrize #7 pay hook | not latched |
| DePrize #8 `state` | `2` (OPEN), betting open, hook latched |

A1 and A2 are done. Before A3, re-read the registry owner and #7. If the owner is already the Safe, or #7 is no longer open, stop and tell Pablo.

## Open the app

The yellow Admin actions box is on the Touchdown v2 branch, pull request
[#1667](https://github.com/Official-MoonDao/MoonDAO/pull/1667), branch
`cursor/deprize-touchdown-v2-7d60`. Production does not have it yet.

```bash
git fetch origin cursor/deprize-touchdown-v2-7d60
git checkout cursor/deprize-touchdown-v2-7d60
cd ui && yarn && yarn dev
```

- Success prize: http://localhost:3000/deprize/sep/7
- Failure prize: http://localhost:3000/deprize/sep/8
- Index: http://localhost:3000/deprize/sep
- Wallet network: Sepolia. The panel has a switch button if it is wrong.
- Gate password: `MOONBASE_GATE_PASSWORD` in `ui/.env.local`. Ask Pablo for the
  file. Do not commit it, and do not paste the password into chat.
- Restart `yarn dev` after you pull.

Connect a signer. The box is titled **Admin actions** and says **Safe signer**.
Each action proposes a Safe transaction and shows **Open in Safe to collect
signatures** plus **Copy link**. Send that link to the other signers. The link
looks like:

`https://app.safe.global/transactions/tx?safe=sep:0xE5148e4399e3D849F629E0FECEcf6fC986e96127&id=multisig_0xE5148e4399e3D849F629E0FECEcf6fC986e96127_<safeTxHash>`

Safe home: https://app.safe.global/home?safe=sep:0xE5148e4399e3D849F629E0FECEcf6fC986e96127

Three of four signatures execute. Eiman does not have to sign when Pablo, Ryan,
and Miguel all do. A signer proposes. The signer’s own wallet does not send the
registry, market, oracle, or Juicebox call.

Sepolia does not block a signer from also betting. That is intentional on #7.
Write the bets down in the scorecard.

## People

| Person | Address | On #7 (success) | On the failure prize |
|---|---|---|---|
| Pablo | `0x679d87D8640e66778c3419D164998E720D7495f6` | Bets 0.01 ETH on Griffin. Signs. Confirms Ryan’s claim. | Signs only. Does not bet. Confirms both refunds in the UI. |
| Ryan | `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` | Bets 0.01 ETH on ispace. Signs. Claims. Gets paid. | Bets 0.01 ETH on Outcome 1. Claims the refund. |
| Miguel | `0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA` | Does not bet. Proposes every Safe transaction and pastes the link. | Bets 0.01 ETH on Outcome 2. Proposes the refund transactions. |
| Eiman | `0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801` | Fourth signer. Optional if the other three sign. | Same. |

Safe: `0xE5148e4399e3D849F629E0FECEcf6fC986e96127` (v1.3.0, threshold 3 of 4).

No MoonDAO team NFT on Sepolia has Pablo, Ryan, and Miguel together. Team 11’s
Safe `0x82997bbAF7A2ccF8f5663D2951eC334e84351b70` has Pablo and Ryan, not Miguel.
Another Safe, `0x8E5343aFaaffbDc1E99B7f1c5E64EeEA5a6de795`, is 3 of 5 and adds
`0x31CDb419E4A7998367627faa24cEe15941795827`. Leave both of those alone.

## Where the money sits

A bet on the Sepolia mint splits three ways:

- About **95%**, plus the existing seed, stays in the LMSR as collateral.
  After `reportPayouts`, the bettor who holds the winning outcome claims on the
  prize page. The claim pays that wallet from the market. The company does not
  receive the bet.
- **5%** goes to the Juicebox project (project **275** on #7). Paying a winner
  from that project uses the surplus allowance, **Send prize** in the panel
  (`useAllowanceOf`). The locked payout split cannot be retargeted.
- **1%** trading fee sits as WETH inside the market. `withdrawFees` pays the
  market owner, which is the Safe. The Safe then sends it on. It does not go
  back into Juicebox.

`settleWinner` only stores a team id. It sends no ETH.

ispace has no MoonDAO wallet. On #7 the “winning team” payment is an address
the signers choose. Ryan’s wallet is the stand-in for this rehearsal.

## What will not move on its own

Juicebox project 275’s locked splits pay about 2.5% to the mission treasury
`0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b`, about 5% to the pool deployer
`0x9cc4EBaA13C274F3bD727fB09C7876606c3Ea23c`, and about 90% to the project
owner (the Safe). Those splits do not run in the current ruleset. The goal is
100 ETH and the deadline is about 2028, so ruleset 1 will not be reached during
this test. Treasury and pool deployer are paid on purpose, with **Send prize**.

`createAndAddLiquidity` on the pool deployer spends the contract’s ETH and its
project tokens. Both balances have to be above zero or the call reverts. It is
permissionless once funded. The PoolDeployer owner is the MissionCreator owner
(the deployer EOA), not the Safe. There is no `onlyOwner` on
`createAndAddLiquidity`.

`cancel()` cannot finish the same day. `CANCELLATION_NOTICE` is 7 days and
cannot be shortened. Same-day refunds are `lock` → `settleNoWinner` →
`reportPayouts` with `[1, 1]`. That is the same refund terminal as cancel
(`NO_WINNER` vs `CANCELLED`). On the day of the test: announce cancellation
(betting stops), confirm `cancel` still reverts, abort (betting resumes), then
use the no-winner path. A later optional prize can sit in the notice and call
`cancel` after 7 days. Claim and Juicebox cash-out are the same code either way.

A no-winner or cancel claim pays about `1/N` of the market collateral for the
tokens that wallet holds. It is not a full return of the 0.01 ETH stake. The
5% already left for Juicebox, the 1% fee stayed in the market, and the LMSR
price moved. Getting the full 0.01 ETH back is a failed test.

Juicebox cash-out of that 5% follows DePrize only after the pay hook is
latched (`setDePrizeRegistry`). #7’s hook is not latched yet. An unlatched
hook uses the mission deadline, about two years out, so a failure refund cannot
return the 5% until that prize’s hook is latched. Latch the failure prize’s
hook when it is created, and latch #7’s hook in Part A.

`reportPayouts` is one-shot. A second call reverts. A call from the deployer
EOA reverts, because the oracle is the Safe. The condition id is
`keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount))`.

Accepting registry ownership moves **every** Sepolia DePrize to the Safe, not
only #7. Night Shift (#3), First Tracks (#5), Water Ice (#6), and the older
Touchdown markets become Safe-operated too. Id 2 stays OPEN on-chain. The
index points at #7. Do not resolve id 2 as part of this test.

## Scorecard

Fill this in as you go. Balances are the checker.

| Field | Value |
|---|---|
| Failure prize id | `8` |
| Failure market | `0xC739aC0D912771619dC8217501D6f6E8Aff27987` |
| Failure Juicebox project | `276` (mission 22) |
| Failure pay hook | `0xCFcF30E399ce63025FaF02311a4977081F956060` (latched) |
| Failure questionId | `0x92780d846f3b3ba767d18baafe154c0c6f44fa1739d362ac2b11c7439feb1111` |
| Failure pool deployer | `0xf177dc243ee9f5DeA7744F52e15Bca73C639F6A5` |
| #7 project 275 ETH before bets | `0` |
| #7 project 275 ETH after bets | |
| Pablo #7 bet tx | |
| Ryan #7 bet tx | |
| Ryan claim tx, ETH received | |
| Pablo claim result | nothing |
| Winner payout recipient and amount | |
| Treasury payout amount | |
| Pool deployer ETH before / after liquidity | |
| Pool deployer token before / after liquidity | |
| `createAndAddLiquidity` tx | |
| Failure: Ryan refund ETH | |
| Failure: Miguel refund ETH | |
| Failure: Juicebox ETH before / after both cash-outs | |

Public reads (Sepolia):

```bash
RPC=https://ethereum-sepolia-rpc.publicnode.com
REG=0x7208B0Ba9B1013000b8D30b60A462079300984E2
cast call $REG 'owner()(address)' --rpc-url $RPC
cast call $REG 'pendingOwner()(address)' --rpc-url $RPC
cast call $REG 'state(uint256)(uint8)' 7 --rpc-url $RPC
cast call $REG 'bettingOpen(uint256)(bool)' 7 --rpc-url $RPC
cast call 0xbA29717EBE6132cDD35061c171f194e4eb16D887 'deprizeRegistry()(address)' --rpc-url $RPC
```

On-chain state numbers for this registry: `0` none, `1` draft, `2` open,
`3` locked, `4` settled, `5` no winner, `6` cancelled, `7` superseded.
The page’s labels are off by a generation. See “Buttons that revert” before
you click anything after a settle.

## Part A — before anyone bets #7

### A1. Failure prize — done

DePrize **#8** is open. Do not provision another one, and do not run
`ui/scripts/provision-touchdown-v2-sepolia.cjs` or
`ui/scripts/provision-failure-rehearsal-sepolia.cjs` again. Do not call
`transferOwnership` on the registry. The pending owner is already the Safe.

| Slot | Value |
|---|---|
| Page | http://localhost:3000/deprize/sep/8 |
| Outcomes | **Outcome 1** (team `701`), **Outcome 2** (team `702`) |
| questionId | `0x92780d846f3b3ba767d18baafe154c0c6f44fa1739d362ac2b11c7439feb1111` |
| conditionId | `0x01d5e48894172154288f36902b7242b92d05875ca78e5caab59371fc94c4096d` |
| Market | `0xC739aC0D912771619dC8217501D6f6E8Aff27987` |
| Seed | 0.02 ETH (`funding()`) |
| Juicebox project | `276`, mission `22`, owner = the Safe |
| Pay hook | `0xCFcF30E399ce63025FaF02311a4977081F956060`, latched, owner = the Safe |
| Pool deployer | `0xf177dc243ee9f5DeA7744F52e15Bca73C639F6A5` |
| Sunset | `1853881556` (2028-09-29 23:05:56 UTC) |

Paste the questionId into the admin panel on #8 or the resolve buttons stay hidden.

The hook had to be latched before the Safe could own it, so `createMission`
named the deployer as `to`, then the hook and the project NFT were transferred
to the Safe. The locked 90% payout split still names the deployer
`0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`. That split does not run in this
ruleset. Surplus payments follow the project owner, which is the Safe.

### A2. Snapshot — done

Recorded 2026-09-30, before any rehearsal bets. Juicebox balances are the
terminal-store balance. Market collateral is `funding()`, not the market
contract’s WETH balance (that balance is 0; the seed sits in the conditional
tokens).

| Account | ETH |
|---|---|
| Pablo `0x679d87D8640e66778c3419D164998E720D7495f6` | 4.389635364623640119 |
| Ryan `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` | 89.950507037385669449 |
| Miguel `0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA` | 0.077346189295693545 |
| Deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` | 2.564454717355290453 |
| Treasury `0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b` | 0.13400039169330874 |
| #7 pool deployer `0x9cc4EBaA13C274F3bD727fB09C7876606c3Ea23c` | 0 |
| #8 pool deployer `0xf177dc243ee9f5DeA7744F52e15Bca73C639F6A5` | 0 |
| Juicebox project 275 | 0 |
| Juicebox project 276 | 0 |
| #7 market `funding()` | 0.07 |
| #8 market `funding()` | 0.02 |

### A3. Accept registry ownership

Miguel proposes **Accept Safe ownership**. Pablo and Ryan sign. Execute.

Check: `owner()` is the Safe. `pendingOwner()` is zero.

This is the blast radius above. Every Sepolia DePrize now answers to this Safe.

### A4. Latch #7’s pay hook

Miguel proposes the latch. Three sign. Execute.

- To: `0xbA29717EBE6132cDD35061c171f194e4eb16D887`
- Data: `0x14c413ea0000000000000000000000007208b0ba9b1013000b8d30b60a462079300984e2`

Check: `deprizeRegistry()` equals the registry. The failure prize’s hook is
already latched from A1. Read it the same way.

### A5. Confirm #7 is ready

- `state(7)` is `2`, `bettingOpen(7)` is true.
- Market `0x7deDb1Ac0f53b0208F72977f941186F6FB2394E9` owner is the Safe.
- Juicebox project 275 owner is the Safe (project NFT
  `0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4`).
- Pablo and Ryan hold zero outcome tokens on #7.

## Part B — success on #7

#7 roster, in order. The resolve button uses the name.

| Index | Button | Team id |
|---|---|---|
| 0 | Griffin Mission One wins | 601 |
| 1 | Nova-C IM-3 wins | 602 |
| 2 | Blue Ghost M2 wins | 603 |
| 3 | Blue Moon MK1 wins | 604 |
| 4 | Chang'e-7 wins | 605 |
| 5 | **ispace wins** | **606** |
| 6 | Open Field wins | 24 |

Question id, already filled on this page:
`0x3b84fc396a95b42df70a164715d33f0f0d64a0ee765958d97b04a709464e0129`.

### B1. Two bets

Pablo, from his own wallet, bets **0.01 ETH** on **Griffin Mission One**.
Ryan, from his own wallet, bets **0.01 ETH** on **ispace**.
Miguel does not bet.

Check:

- Pablo holds Griffin tokens and no ispace tokens.
- Ryan holds ispace tokens and no Griffin tokens.
- Project 275 is up by about 0.001 ETH (5% of 0.02).
- The rest of the bets are in the market, with the 0.07 ETH seed.

### B2. Claim before resolution

There is no **Claim** button yet. That is expected.
One of the two bettors calls `redeem(7)` on
`0x7a6B6AaC8Efbe894EDEe224a6bC3b09874c10849`. It must revert.
Screenshot the revert.

### B3. Lock

Miguel proposes **Lock betting**. Three sign. Execute.

Check: `bettingOpen(7)` is false, `state(7)` is `3`.
Pablo tries another small bet. It must fail. Screenshot that.

### B4. Record the winner

Miguel proposes **Settle winner** with **ispace** selected. Three sign. Execute.

This stores team id 606. It does not send ETH. Project 275’s balance does not
move. Ryan cannot claim yet.

The page may now say **Voting**. The on-chain state is `4` (settled). Leave
**Start winner vote** and **Settle: no winner** alone. Those proposals revert.

### B5. Pause, then resolve ispace

Miguel proposes **Pause** on the market. Three sign. Execute. The market has
to be paused before the resolve buttons will send.

Then Miguel proposes **ispace wins**. Three sign. Execute.

That is `reportPayouts` on `0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8` with a
`1` only at index 5: `[0, 0, 0, 0, 0, 1, 0]`. One shot. Do not click another
resolve button in this part.

Check: the page shows the payout as resolved. A second proposal of **ispace
wins** either stays hidden behind “Already resolved” or reverts when executed.
That second attempt is a pass only if it does not send.

### B6. Claims

Ryan presses **Claim** on `/deprize/sep/7` and receives ETH.
Pablo presses **Claim** and receives nothing.

The claim pays from the market, through the redeem helper. It is not the
Juicebox payment in the next step.

### B7. Juicebox to the winning-team stand-in

In **Juicebox prize pool**, set the recipient to Ryan’s wallet
`0xB2d3900807094D4Fe47405871B0C8AdB58E10D42`.
Type an amount that leaves a remainder. Do not press **Use full balance** and
then send that number. Example when the project holds about 0.001 ETH: send
the balance minus 0.0003 ETH. Write the amount in the scorecard.

Miguel proposes **Send prize**. Three sign. Execute.

Check: project 275 dropped by that amount, and Ryan’s wallet rose by it.
This ETH is separate from his claim in B6.

### B8. Treasury

From the remainder, **Send prize** to the mission treasury
`0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b`.
Write the amount down. A small recorded amount is enough (for example
0.0002 ETH). Leave a little ETH in the project for the pool deployer.

The 2.5% split will not move by itself. The pass is: treasury ETH increased
by the amount you sent, and you can point at the Safe transaction.

### B9. Liquidity

1. **Send prize** a little ETH (for example 0.0001 ETH) to the pool deployer
   `0x9cc4EBaA13C274F3bD727fB09C7876606c3Ea23c`.
2. Put project tokens on that same contract. Pending reserved tokens are sent
   with `sendReservedTokensToSplitsOf(275)` on the Juicebox controller
   `0x27da30646502e2f642bE5281322Ae8C394F7668a`. The pool deployer is one of
   the reserved-token splits. If this call reverts, stop. Do not call
   `createAndAddLiquidity` while either balance is zero.
3. Read both balances. ETH greater than 0 and project tokens greater than 0.
4. Anyone calls `createAndAddLiquidity()` on the pool deployer.

Check: both balances drop. A revert with “no funds to deploy” is a fail.

## Part C — failure prize

Use DePrize #8 at http://localhost:3000/deprize/sep/8. Paste this questionId
into the admin panel before any resolve button:

`0x92780d846f3b3ba767d18baafe154c0c6f44fa1739d362ac2b11c7439feb1111`

### C1. Two bets

Ryan bets **0.01 ETH** on **Outcome 1**.
Miguel bets **0.01 ETH** on **Outcome 2**.
Pablo does not bet.

Check: each wallet holds only its outcome. The new Juicebox project is up by
about 5% of 0.02 ETH.

### C2. Pause and resume

Miguel proposes **Pause**. Three sign. A new bet fails. Screenshot.
Miguel proposes **Resume**. Three sign. A new bet succeeds. Screenshot.

### C3. Sell a little back

While the market is open, Ryan or Miguel sells a **tiny** piece of their
position with **Cash out** on the outcome card. That sells back to the market.
It is not **Claim**, and it is not the Juicebox token cash-out in C7.
Check: that wallet’s outcome-token balance dropped and its ETH rose by the
sale quote.

### C4. Sweep the 1% fee

The panel’s **Withdraw fees** button stays disabled until **Close market**.
Do not close the market. Close sends the market’s outcome tokens to the Safe
and needs an ERC-1155 fallback handler. Pause and `withdrawFees` do not.

Miguel proposes a Safe transaction straight to the failure market:

- Data: `0x476343ee` (`withdrawFees()`)

WETH arrives at the Safe. Unwrap it: WETH
`0x8cfF28F922AeEe80d3a0663e735681469F7374c6`, `withdraw(uint256)` for the
amount received. Then send that ETH to the treasury
`0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b`.

Check: the market’s WETH fee balance is back to dust, the treasury rose by
the unwrapped amount, and the Juicebox project did **not** rise by that
amount. Paying the fee into the project is a fail.

The fee is about 1% of the trades, so the amount is small. The direction is
the test.

### C5. Deployer cannot resolve

From the deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`, call
`reportPayouts` on the CTF for this prize’s questionId. It must revert.
Do this from that EOA, not from a Safe proposal. A Safe proposal would succeed
and burn the one-shot.

### C6. Notice, then the same-day refund

1. Miguel proposes **Announce cancellation**. Three sign.
   Check: betting is closed. Ryan confirms the page will not take a bet.
2. Miguel proposes **Execute cancel**. It must revert. The 7-day notice has
   not elapsed. Screenshot the failed execution. Leave the notice in place
   only long enough to see that failure.
3. Miguel proposes **Abort cancellation**. Three sign.
   Check: betting is open again.
4. Miguel proposes **Lock betting**, then **Settle: no winner**.
   Check: `state` is `5` (no winner). The page may label that **Settled** and
   offer **Release M1 (30%)**. Leave that button alone. It is not on this registry.
5. Miguel proposes **Pause**, then **No winner (refund 1/N)**.
   That is `reportPayouts` with `[1, 1]`.

### C7. Both bettors get the market slice and the Juicebox slice

Ryan and Miguel each press **Claim**. Each receives some ETH. Neither receives
their full 0.01 ETH back. Write both amounts down. Together they should be
about the market collateral split by the `[1, 1]` vector, not `0.02 ETH`.

Then each cashes out mission tokens on that prize’s mission page (the refund
section, `cashOutTokensOf`). This is the 5% Juicebox slice. It only appears
when the latched hook sees `NO_WINNER`.

Check: the project balance falls by about what the two of them put in. If the
hook was not latched, this cash-out stays closed until the mission deadline,
and the failure test fails.

### C8. Optional day-8 cancel

Leave a third tiny prize announced, and run **Execute cancel** after the 7-day
notice. Claim and Juicebox cash-out are the same as C7. This is not required
to pass the rehearsal.

## Part D — one check with an outsider

A wallet that is not Pablo, Ryan, Miguel, or Eiman opens `/deprize/sep/7`.
The Admin actions box is absent. That wallet cannot queue a Safe transaction.
Screenshot.

## Buttons that revert

The panel still offers calls this registry does not have. After `settleWinner`
the chain says `4` and the page treats `4` as “Voting”. After `settleNoWinner`
the chain says `5` and the page treats `5` as a later milestone. Do not click:

- Start winner vote
- Release M1 (30%)
- Complete M2 (70%)
- Fail M2 (refund)
- Set provider

**Claim** follows the conditional-token payout, so it still appears after a
real `reportPayouts` even when the lifecycle label is wrong.

## Pass bar

All of these are true:

- Two wallets bet two outcomes on #7, and two wallets bet two outcomes on the
  failure prize.
- On #7, Ryan’s claim pays him and Pablo’s claim pays nothing.
- The chosen winner address received Juicebox ETH. The treasury received a
  separate recorded payment. Those are two Safe transactions.
- The pool deployer held ETH and project tokens, and `createAndAddLiquidity`
  reduced both.
- On the failure prize, announce closed betting, `cancel` reverted, abort
  reopened betting, and both bettors were then refunded from the market at
  about `1/N` plus the Juicebox slice.
- Every Safe step was proposed by Miguel and confirmed by three signers.
- The scorecard matches the balances after each part.

## Appendix — #7 addresses and calldata

| Slot | Value |
|---|---|
| Registry | `0x7208B0Ba9B1013000b8D30b60A462079300984E2` |
| Mint | `0x22E22C4135be93595f341e072321D18e7D4Ee0D0` |
| Redeem | `0x7a6B6AaC8Efbe894EDEe224a6bC3b09874c10849` |
| Conditional tokens | `0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8` |
| WETH | `0x8cfF28F922AeEe80d3a0663e735681469F7374c6` |
| Stock LMSR factory | `0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674` |
| Market | `0x7deDb1Ac0f53b0208F72977f941186F6FB2394E9` |
| questionId | `0x3b84fc396a95b42df70a164715d33f0f0d64a0ee765958d97b04a709464e0129` |
| conditionId | `0x35c9bb3e9cb590b85be331ae1a2ebcbb0c49fed64579c806d897ce6ef8b22465` |
| Juicebox project | `275` (mission 21) |
| Pay hook | `0xbA29717EBE6132cDD35061c171f194e4eb16D887` |
| Juicebox terminal | `0x2dB6d704058E552DeFE415753465df8dF0361846` |
| Juicebox controller | `0x27da30646502e2f642bE5281322Ae8C394F7668a` |
| Project NFT | `0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4` |
| Pool deployer | `0x9cc4EBaA13C274F3bD727fB09C7876606c3Ea23c` |
| Mission treasury | `0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b` |
| MissionCreator | `0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1` |

| Call | To | Data |
|---|---|---|
| Accept ownership | registry | `0x79ba5097` |
| Latch #7 hook | pay hook | `0x14c413ea0000000000000000000000007208b0ba9b1013000b8d30b60a462079300984e2` |
| Pause market | market | `0x8456cb59` |
| Resume market | market | `0x046f7da2` |
| Withdraw fees | market | `0x476343ee` |

Do not use the Phase 2 LMSR factory. Do not close the market
(`0x43d726d6`) during this rehearsal.
