# Paying the Citizen Referral Quest in ETH

Prepared Oct 21, 2026. On-chain values were read from Arbitrum on that date. ETH was $2,467.31 (CoinGecko).

## Summary

- **The current reward is close to nothing.** The first referral pays 1,000 MOONEY, which is about **$0.17**. Twenty-five referrals pay 44,000 MOONEY in total, about **$7.40**. Since Sept 2025 the quest has paid about 20,050 MOONEY in all, roughly $3.40.
- **Your numbers match the contracts.** A full-price Citizenship costs **0.036 ETH** (about $88.82). Of that, **0.027 ETH** goes to the Treasury and **0.009 ETH** buys MOONEY for the new Citizen. Splitting the Treasury's 0.027 in half gives **0.0135 ETH (about $33.31)** to the referrer and 0.0135 ETH to the Treasury.
- **It can be built.** The quest system (`XPManager`) can't pay it, because it only pays one ERC-20 token at one global rate for every quest. The clean way is a new version of `CitizenCheckout` that takes the referrer as a mint argument and pays the referrer in the same transaction. An interim version can run off-chain through the same HSM wallet that already sends gas stipends.
- **One hole must close first.** Today any Citizen, old or new, can name a referrer at any time, and nothing checks that they paid. With ETH attached, the 246 existing Citizens who have no referrer could claim about **3.3 ETH (about $8.2k)**. The ETH bonus has to be tied to a new, full-price mint.
- **It never costs the Treasury cash out of pocket.** Each bonus comes out of the new Citizen's own payment. The only real cost is paying for sign-ups that would have happened anyway. Counting first-year revenue alone, it breaks even when **at least half of referred sign-ups are truly new**. Counting renewals, the bar drops to about 36% (see the economics section).

## 1. How it works today

### Where a Citizenship payment goes

| Item | Value (live) | Source |
|---|---|---|
| `MoonDAOCitizen.pricePerSecond` | 856,165,313 wei/s, which is 0.0270 ETH/yr | `0x6E46…E002` |
| `CitizenCheckout.quote()` | treasury 0.0270 / stake 0.0090 / total 0.0360 ETH | `0xdCad…D04D` (live, not paused) |
| Treasury that receives the ETH | `0xAF26a002d716508b7e375f1f620338442F5470c0` | `MoonDAOCitizen.moonDAOTreasury` |
| What 0.009 ETH buys | about 112,400 MOONEY (1% Uniswap v3 pool) | QuoterV2 |

How a mint flows (`subscription-contracts/src/CitizenCheckout.sol`):

```
wallet pays 0.036 ETH → CitizenCheckout.mint()
   ├─ 0.027 → MoonDAOCitizen.mintTo() → forwarded to Treasury (ERC5643Citizen.sol:193)
   └─ 0.009 → WETH → MOONEY swap → sent to the new Citizen (locked as vMOONEY when a lock is open)
```

`mintTo` only accepts calls from the checkout, through `CheckoutOnlyMinter`. **Renewals are not gated**: `renewSubscription` is public at 0.027 ETH. This matters for the design choice in section 3.

The price change is recent (commits `aed8f5c62` and `3a1bb8ebb`, Oct 2). Every self-paid mint in the last 13 months was at the old 0.0111 ETH. Nobody has paid the 0.036 price yet in the window I scanned.

### The referral quest

- **Verifier:** `CitizenReferralsStaged` at `0x0BD9…6C66` (`xp/src/verifiers/CitizenReferralsStaged.sol`).
- **Recording:** after the mint, the new Citizen's browser calls `POST /api/xp/citizen-referred` (`ui/pages/api/xp/citizen-referred.ts`). The server's HSM signer (`0xb206…5d32`) then calls `referred(referee, referrer)`. The same call is also open later from the "Record Referral" modal (`ui/components/subscription/CitizenReferral.tsx`), with **no time limit and no check on payment**.
- **Checks today:** both addresses hold a Citizen NFT, no self-referral, and one referrer per referee.
- **Reward:** the XP stages are 1 / 3 / 5 / 10 / 25 referrals, worth 1k / 3k / 5k / 10k / 25k XP. `XPManager` converts **1 XP to 1 MOONEY** for every quest (`setERC20RewardConfig`, MOONEY, rate 1e18). Its MOONEY balance is 1.97M.
- **Volume, from on-chain logs since the Sept 2025 launch:**
  - **20 referrals**, from 9 referrers. The top referrer has 6.
  - 14 referrals in the last 365 days and 5 in the last 90 days.
  - Over the same 13 months there were 131 Citizen mints: 74 self-paid, 33 sponsored by the HSM, and 24 zero-value.
  - That puts referrals at about 15% of mints.

The code comments in the verifier are wrong. They say "5 referrals = 3000 XP, total 39000". The real thresholds are 1 / 3 / 5 / 10 / 25, and the total is 44,000.

### The gas airdrop

`ui/pages/api/mission/freeMint.ts:770` sends **0.00025 ETH (about $0.62)** through `sendEthFromHSM()` (`ui/lib/google/hsm-signer.ts:708`). It only does this for **fully sponsored** (free-invite) mints; partial-discount mints get nothing. The HSM wallet now holds **0.0444 ETH**. This is the same key that serves as the `CitizenCheckout` sponsor and the referral `authorizedSigner`. ETH payouts from the server already work, so the interim option is mostly plumbing.

## 2. The economics

### Per sign-up

ETH is $2,467.31. The split assumes the 50/50 is taken from the Treasury's share.

| | ETH | USD | Share of wallet payment |
|---|---|---|---|
| New Citizen pays | 0.0360 | $88.82 | 100% |
| **Referrer bonus** | **0.0135** | **$33.31** | 37.5% |
| Treasury (net) | 0.0135 | $33.31 | 37.5% |
| MOONEY bought for the new Citizen | 0.0090 | $22.21 | 25% |
| *No referrer: Treasury* | *0.0270* | *$66.62* | *75%* |

The MOONEY share does not change. Only the Treasury's share is split.

To compare: 0.0135 ETH buys about **160,000 MOONEY** in the pool. That is roughly 160 times today's first-referral reward.

### Annual payout at different volumes

| Referred full-price sign-ups per year | Paid to referrers | USD | Treasury still nets |
|---|---|---|---|
| 14 (current pace) | 0.19 ETH | $466 | 0.19 ETH |
| 50 | 0.68 ETH | $1,665 | 0.68 ETH |
| 100 | 1.35 ETH | $3,331 | 1.35 ETH |
| 250 | 3.38 ETH | $8,327 | 3.38 ETH |

The bonus is paid once per new Citizen. Renewals pay the referrer nothing.

### Break-even

Every referred sign-up is one of two kinds:

- **New** (it would not have happened without the bonus): the Treasury gains 0.0135 ETH.
- **Would have joined anyway:** the Treasury gives up 0.0135 ETH.

Counting first-year revenue alone, it breaks even at **50% new**. A new Citizen also brings future renewals at the full 0.027 ETH with no bonus. At a 40% renewal rate, the break-even drops to about **36% new** (0.0135 ÷ (0.0135 + 0.0135 + 0.4 × 0.027)).

Given how few referrals the quest drives today, almost any referral the bonus creates is likely to be new. The risk is in step-ups later, for example if the first paid acquisition campaign gets credited to referrers.

### Compared to the EB proposal

`docs/EB_PROPOSAL_Q4_2026_Q1_2027.md` already proposes this idea:

- A $99 Citizenship, with $25 of staked MOONEY for the Citizen and **$25 to the referrer in ETH or USDC**.
- It "replaces the current MOONEY referral reward", is paid once per new paying Citizen, and keeps the existing checks.

Your version charges $89 (0.036 ETH) and gives the referrer about $33. That is more generous to the referrer. The Treasury nets about $33 per referred Citizen, against about $49 under the EB draft.

Either works. Pick one so the proposal and the build match.

## 3. Technical options

### Why `XPManager` can't do this

`XPManager` has one ERC-20 config: one token and one XP-to-token rate. It is paid out inside every quest claim. Switching it to WETH would pay every quest in WETH. A per-quest ETH reward would need an `XPManager` upgrade (it's UUPS, so this is possible) plus a funded ETH balance, and the quest still wouldn't know whether the referee paid in full.

**Recommendation:** leave XP and levels as they are. The MOONEY those stages pay is trivial. Pay the ETH where the money already moves: the checkout.

### Option A: `CitizenCheckoutV2` with a referrer argument (recommended)

```solidity
function mint(Profile calldata profile, address referrer, uint256 minMooneyOut) external payable {
    (uint256 treasury, , uint256 total) = quote(profile.to, ONE_YEAR);
    if (msg.value < total) revert PaymentTooLow(total, msg.value);
    tokenId = _mint(profile, treasury);                       // 0.027 → Treasury (unchanged)
    _buyAndDeliver(profile.to, msg.value - treasury, minMooneyOut);  // 0.009 → MOONEY (unchanged)
    if (treasury > 0 && _eligible(referrer, profile.to)) {
        uint256 bonus = treasury * referralBps / 10_000;      // 5000 bps = 0.0135
        _payOrOwe(referrer, bonus);                           // from the referral reserve
        emit ReferralPaid(profile.to, referrer, bonus);
    }
}
```

- **Where the 0.0135 comes from.** It comes from an ETH **referral reserve** that the Treasury Safe deposits into the checkout. A starting deposit of 0.5 ETH covers about 37 referrals.
  - Economically this is the 50/50 split: the Treasury receives 0.027 and puts 0.0135 back.
  - It does **not** require changing the Citizen price. Halving `pricePerSecond` would also halve the price of direct `renewSubscription` calls and `CrossChainMinter` mints, which skip the checkout.
- **Eligibility, checked on-chain:**
  - `referrer` is not the new Citizen and not the sender.
  - The referrer holds an **active**, unexpired Citizen NFT.
  - The mint is full price, through `mint` only. Not `mintSponsored`, and not a discount-list address.
- **Safe payment.** Try to send the bonus directly. If the send fails or the reserve is empty, record it in `owed[referrer]` and let the referrer `claim()` it later. A smart-wallet referrer or an empty reserve must never block a mint.
- **Owner controls** (Admin Safe):
  - `referralBps`, so the bonus follows price changes.
  - A pause for referral payments.
  - An optional per-referrer cap per quarter.
  - `withdrawReserve`.
- **XP still counts.** The server watches `ReferralPaid` and keeps calling `CitizenReferralsStaged.referred()` with the HSM signer, so quest levels keep working.
- **Rollout, as one Admin Safe batch** (like `subscription-contracts/script/PrintPricingSafeBatch.s.sol`):
  1. Deploy V2 and a new `CheckoutOnlyMinter(V2)`.
  2. Point the Citizen whitelist at the new minter.
  3. Fund the reserve.
  4. Switch `CITIZEN_CHECKOUT_ADDRESSES` in `ui/const/config.ts`.
  5. Pass the referrer into the mint call.

  Renewals keep using V1 or move to V2 unchanged.
- **App work:** `CreateCitizen.tsx` reads `?referredBy` only after the mint. The referrer has to be saved when the visitor lands (localStorage or the attribution record in `ui/lib/analytics/attribution.ts`), so it survives the Coinbase onramp detour. It also needs to show on the review step ("Referred by X, who receives $33").
- **Effort:** about 1 to 2 weeks for the contract, Foundry tests (copying `CitizenCheckout.t.sol`), a review pass, the Safe batch and the UI.

### Option B: pay from the server through the HSM (interim, a few days)

Extend `/api/xp/citizen-referred`:

1. Load the referee's mint transaction. Confirm it went to `CitizenCheckout.mint`, came from the referee's wallet with value ≥ `quote().total`, happened after a launch date, and was recorded within N days of minting.
2. Take a Redis lock keyed on the referee so the bonus can't be paid twice.
3. Call `sendEthFromHSM(referrer, 0.0135 ETH)` and log the transaction hash.
4. Keep recording XP as today.

- **Pros:** no contract change, and it reuses what already runs.
- **Cons:**
  - The bonus sits in a hot wallet. 0.044 ETH today covers about 3 payouts.
  - It relies on the server's checks, not on-chain rules.
  - The referee has to stay on the page or come back to trigger it.

This is a fine way to test whether $33 changes behaviour before the contract ships.

## 4. Abuse and policy

| Risk | Mitigation |
|---|---|
| **Existing Citizens naming a referrer after the fact** (246 without one, about 3.3 ETH) | Pay ETH only for mints after launch, with the referrer captured at mint (A) or within N days (B). Older referrals stay XP-only. |
| Self-referral through a second wallet | It's a 37.5% discount, not a profit: pay 0.036, get back 0.0135. Accept it. Requiring an active Citizen referrer raises the cost. |
| Discounted and free invites | No bonus. Free invites already cost the Treasury the gas stipend. |
| Paid-ad traffic credited to referrers | The referral link sets the referrer. Clear any stored referrer when the visitor arrives with campaign UTMs, or last-touch wins. Decide which. |
| Renewal farming | The bonus is one-time per new Citizen. Renewals pay nothing. |
| ETH price swings | The bonus is a fixed fraction of the price (`referralBps`), so it moves with the quarterly price review. |
| Tax and legal | Cash referral payments may be taxable income for recipients. Check with counsel alongside the EU/UK registration work in the EB proposal. |

## 5. Recommendation

1. **Agree the numbers.** Either 50% of the Treasury share (0.0135 ETH, about $33), or the EB draft's $25. I'd go with 50% in bps. It's simple to explain ("half of what MoonDAO receives goes to you"), and it tracks price changes automatically.
2. **Close the after-the-fact loophole** before any ETH is attached.
3. **Ship Option B for a 60-day pilot** with the HSM funded at 0.25 ETH, if you want proof fast. Otherwise go straight to **Option A**, which is the right permanent design.
4. **Update the copy:** the quest card, the "share it to earn MOONEY!" toast (`ui/lib/xp/config.ts:161`), and `/join`. "Earn $33 in ETH for every friend who becomes a Citizen" is a much stronger message than 1,000 MOONEY.
5. **Measure** referred share of paid mints, referrers per month, and new versus returning traffic. Run the break-even test at the end of the pilot.
