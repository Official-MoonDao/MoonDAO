# Touchdown v2 — Sepolia dress rehearsal

Sepolia DePrize **#7**. The executive Safe operates the market, the Juicebox
project, and (after it accepts) the registry. Three of four signatures are
required. Signers:

| Signer | Address |
|---|---|
| Pablo | `0x679d87D8640e66778c3419D164998E720D7495f6` |
| Ryan | `0xB2d3900807094D4Fe47405871B0C8AdB58E10D42` |
| Miguel | `0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA` |
| Eiman | `0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801` |

Safe: `0xE5148e4399e3D849F629E0FECEcf6fC986e96127` on Sepolia, version 1.3.0,
threshold 3.

No MoonDAO team NFT on Sepolia has Pablo, Ryan, and Miguel as signers. The
only team Safe with both Pablo and Ryan is team **11**
(`0x82997bbAF7A2ccF8f5663D2951eC334e84351b70`), and Miguel is not on it.
A second Safe, `0x8E5343aFaaffbDc1E99B7f1c5E64EeEA5a6de795`, has the same four
people plus `0x31CDb419E4A7998367627faa24cEe15941795827` at threshold 3 of 5.
This rehearsal uses the 3-of-4.

The yellow admin panel on the prize page compares the connected wallet to
`owner()`. It will not appear for any one signer. Run these transactions from
the Safe app.

Accepting registry ownership moves **every** Sepolia DePrize, not only #7.
Night Shift, First Tracks, and Water Ice become Safe-operated too.

## Already true, before you sign anything

- Betting is open on #7. Seven outcomes, ispace is slot 6 (team id `606`).
- The market `0x7deDb1Ac0f53b0208F72977f941186F6FB2394E9` is owned by the Safe.
- Juicebox project **275** is owned by the Safe.
- The condition's oracle is the Safe. Only the Safe can call `reportPayouts`.
- The registry's pending owner is the Safe. The deployer is still the owner
  until `acceptOwnership()`.

## 1. Accept registry ownership

To: `0x7208B0Ba9B1013000b8D30b60A462079300984E2`

Data: `0x79ba5097`

Check: `owner()` equals the Safe. `pendingOwner()` is zero.

## 2. Latch the pay hook

To: `0xbA29717EBE6132cDD35061c171f194e4eb16D887`

Data: `0x14c413ea0000000000000000000000007208b0ba9b1013000b8d30b60a462079300984e2`

Check: `deprizeRegistry()` equals the registry. Until this lands, Juicebox
cash-out does not follow the DePrize state.

## 3. Place a small bet

From a wallet that is **not** a Safe signer, on Sepolia, open `/deprize/sep/7`.
Back Griffin (outcome 1) with a small amount of test ETH.

Check: the transaction succeeds, the position shows on that outcome, and
Juicebox project 275's balance increased by about 5% of the bet. The other
95% stayed in the market.

## 4. Sweep the trading fee to the treasury

The 1% fee sits as WETH in the market. It does not wait for the Juicebox
project to end.

To the market `0x7deDb1Ac0f53b0208F72977f941186F6FB2394E9`, data `0x476343ee`
(`withdrawFees()`). The WETH arrives at the Safe.

Unwrap with WETH `0x8cfF28F922AeEe80d3a0663e735681469F7374c6`,
`withdraw(uint256)` for the amount received.

Send that ETH to the treasury you want as passive income. Do not pay it back
into project 275. Paying it into the project is what the old sweep script
does, and this rehearsal is checking the other route.

Check: the market's WETH balance is back to the fee dust (or zero), and the
treasury balance rose by the unwrapped amount.

## 5. Pause and resume

Pause the market: to the market, data `0x8456cb59`. A new bet should fail
while it is paused.

Resume: data `0x046f7da2`. A new bet should succeed again.

## 6. Lock betting

From the Safe, call `DePrizeRegistry.lock(7)`.

Check: `bettingOpen(7)` is false and `state(7)` is `LOCKED` (3). The market
can still be resumed; lock is the registry, pause is the market.

## 7. Settle a winner, then pay the team

`settleWinner(7, 606)` records ispace. It does not send ETH. The team id is
only a roster slot. ispace has no MoonDAO wallet.

From the Safe, as owner of Juicebox project 275, send the project's ETH to
the wallet you want to test as the winner. Ruleset 0 has a surplus allowance
for this. The locked payout split still names the Safe, not ispace, so do
not use the split. Name the recipient in the allowance call.

Check: project 275's balance dropped, and the recipient received the ETH.
Bettors have not been paid yet. That is the next step.

## 8. Resolve the bet

Pause or close the market first. Then the Safe calls `reportPayouts` on
`0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8`. The question id is
`0x3b84fc396a95b42df70a164715d33f0f0d64a0ee765958d97b04a709464e0129`.
The vector has seven numbers. A 1 in position 6 (0-based index 5) pays
ispace's outcome. Any other single 1 pays that slot. All 1s is the refund.

This can only be sent once, and only by the Safe. Use a throwaway mental
note of which slot you pick before you sign. The bettor from step 3 should
then redeem on `/deprize/sep/7` and receive ETH if you paid their slot.

Do not run this step until steps 1–7 are signed off. It cannot be undone.

## 9. What this does not cover

Cancellation (`announceCancellation`, wait 7 days, `cancel`) uses the same
Safe and the same registry. Run it on a later prize if you want that path.
Doing it on #7 after step 8 is too late to rehearse a live cancel.

Close (`0x43d726d6` on the market) sends the market's outcome tokens to the
Safe. The Safe's fallback handler must accept ERC-1155. Confirm that before
you close. Pause and `withdrawFees` do not need it.
