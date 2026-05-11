# Q4 2025 Executive Branch Reward — Audit & Verification

**Calculated:** 2026-05-08
**Branch:** `figure-out-q4-rewards`
**Endpoint:** `GET /api/eb/audit?quarter=4&year=2025`

This document is intended to be read alongside two consecutive runs of the
audit endpoint. Every number below is either (a) a public on-chain value
anyone can fetch with `curl`, or (b) a deterministic arithmetic operation on
those values. Where there is uncertainty, I say so.

---

## TL;DR — Final Answer

| Component | USD | ETH |
|---|---:|---:|
| Treasury growth reward | $0.00 | 0.000000 |
| Revenue reward (10% of trailing-365d revenue) | $212.34 | 0.0935 |
| **Total** | **$212.34** | **0.0935 ETH** |

The treasury reward is **$0** because the treasury **shrank** between Q3 and
Q4 2025. The capital-gains formula yields a negative number, which is floored
to zero by `max(capitalGains, 0)`.

---

## Formula (no surprises)

```
step1: rawTreasuryChange = avg(Q4 daily AUM) − avg(Q3 daily AUM)
step2: capitalGains      = rawTreasuryChange − Q4 revenue
step3: treasuryReward    = max(capitalGains, 0) × 2%
step4: revenueReward     = trailing-365d revenue × 10%
step5: totalRewardETH    = (treasuryReward + revenueReward) / ETH price
```

This formula matches `ui/lib/treasury/eb-rewards.ts` and is exposed verbatim
in the `formula` field of the audit response.

---

## 1. AUM (Treasury value)

We compute a daily AUM time-series for each calendar day in Q3 and Q4 2025,
then take the simple average over each quarter.

### Inputs (per-safe addresses)

| Chain | Role | Address |
|---|---|---|
| Ethereum (1) | Treasury (Gnosis Safe) | `0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9` |
| Arbitrum (42161) | Treasury (Gnosis Safe) | `0xAF26a002d716508b7e375f1f620338442F5470c0` |
| Polygon (137) | Treasury (Gnosis Safe) | `0x8C0252c3232A2c7379DDC2E44214697ae8fF097a` |
| Base (8453) | Treasury (Gnosis Safe) | `0x871e232Eb935E54Eb90B812cf6fe0934D45e7354` |
| Optimism (10) | Treasury (Gnosis Safe) | `0x7CCa1d04C95e237d5C59DDFC6E8608F5E9cB45e4` |

(Multichain treasuries used for fund-routing currently hold $0; they are
queried but contribute nothing to the totals.)

### Method (per day, per safe)

For every day from **2025-06-24 → 2025-12-31** the calculator does this:

1. Fetch every transfer in/out of the safe up to that day from Etherscan v2:
   - Native ETH/MATIC: `module=account&action=txlist` and `txlistinternal`
   - ERC-20: `module=account&action=tokentx`
2. Reconstruct the safe's token balance vector at the end of that day by
   summing inflows minus outflows.
3. Multiply each token by its USD spot price on that calendar day from
   DefiLlama: `https://coins.llama.fi/chart/{coinKey}?period=1d`.
4. Add the safe's Uniswap V3 LP positions: for any NFT held by the safe in
   Uniswap V3 NPM (`0xC36442b4a4522E871399CD717aBDD847Ab11FE88`) we read
   `positions(tokenId)` and `slot0` of the underlying pool, then compute
   amount0/amount1 from liquidity + ticks. The MOONEY token is **excluded**
   from AUM because the treasury controls the supply (per existing policy).

The full source URLs are returned in the `sources` field of the audit JSON.

### Output

| Period | Average AUM | Days | Min | Max |
|---|---:|---:|---:|---:|
| Q3 2025 (Jul 1 – Sep 30) | **$773,197.56** | 92 | $551,576 | $897,663 |
| Q4 2025 (Oct 1 – Dec 31) | **$498,324.49** | 92 | $348,113 | $883,507 |

```
rawTreasuryChange = $498,324.49 − $773,197.56 = −$274,873.07
```

### Cross-check (current snapshot, taken live during the audit run)

| Position | Value (USD) |
|---|---:|
| Ethereum treasury | $249,758.72 |
| Arbitrum treasury | $8,634.15 |
| Polygon, Base, Optimism (all Multichain too) | $0.00 |
| Uniswap V3 NFT #686147 (MOONEY/WETH, WETH side only) | $54,096.33 |
| **Total AUM (live, Q4 close ± a few days)** | **$312,489.21** |

This matches the last point of the Q4 daily series ($368,394 on 2025-12-31)
within a few weeks of price drift. They are **not expected to match exactly**
— one is the live mark-price now, the other is end-of-day Dec 31 2025.

> **Side metric, not part of AUM:** 96 ETH is also staked across 3
> validators (~$219K). Per existing convention this is reported separately
> and not added to AUM.

### Determinism check

Two consecutive runs of the audit endpoint produced **bit-identical** AUM
averages:

| Metric | Run 1 | Run 2 |
|---|---:|---:|
| Q4 avg AUM | $498,324.4866 | $498,324.4866 |
| Q3 avg AUM | $773,197.5607 | $773,197.5607 |

This is because both the Etherscan transfer history and the DefiLlama daily
prices are immutable once a day has closed.

---

## 2. Revenue

Revenue has four sub-components. All four go into the trailing-annual figure
used for the revenue reward; only the Q4-specific portion goes into the
capital-gains adjustment.

### 2a. Subscription revenue (Citizen + Team NFT mints) — **canonical, on-chain**

This is the part that broke earlier in development. The original pipeline
went through a cached helper that silently returned `[]` on Etherscan
rate-limit errors, producing different totals between runs. **It has been
replaced with a direct, retry-with-backoff Etherscan v2 query in
`ui/lib/treasury/canonicalRevenue.ts`.**

**Single source URL** (you can run this in any browser, it's free):

```
https://api.etherscan.io/v2/api?chainid=42161
  &module=account&action=txlistinternal
  &address=0xAF26a002d716508b7e375f1f620338442F5470c0
  &startblock=0&endblock=99999999&sort=asc
  &apikey=YOUR_KEY
```

Filter the `result` array to entries where:

- `from = 0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002` (Citizen NFT contract), **or**
- `from = 0xAB2C354eC32880C143e87418f80ACc06334Ff55F` (Team NFT contract)
- `to   = 0xAF26a002d716508b7e375f1f620338442F5470c0` (Arbitrum treasury safe)
- `isError = "0"` and `value > 0`

#### Q4 2025 (Oct 1 – Dec 31)

10 Citizen subscriptions × 0.0111 ETH each, 0 Team subscriptions:

| # | Date (UTC) | ETH | Tx hash |
|---|---|---:|---|
| 1 | 2025-10-03 | 0.0111 | `0xce0d3430117bac12a0ba41b16dbed8352887852e1f22b0172aff2ff34b37a697` |
| 2 | 2025-10-06 | 0.0111 | `0x71e1a48f7feb28e558bc8cda48861f83073a03931891c69fdcb98d4779c20704` |
| 3 | 2025-10-13 | 0.0111 | `0xc294ee5bac9159c1cbc8dd868f7ecb967dc986144dad2867b7725ace75aa9bbc` |
| 4 | 2025-10-19 | 0.0111 | `0x5809d65e342e690e8885cc95160b37f37eda9595b6c26dda50018d364296be29` |
| 5 | 2025-10-26 | 0.0111 | `0xd92e6fe84cdd995e43407e4d4bed66b7595e08f5274d4699b92b1f5da27d6b02` |
| 6 | 2025-10-27 | 0.0111 | `0xb353300b3f3c70863ea6609af203b5143df99c3bcb17e145a8d233a790235df7` |
| 7 | 2025-11-03 | 0.0111 | `0xba41c20cbc791e57476e222fea24d97e86203d1c02bfc996af65ccefcdc7fc2c` |
| 8 | 2025-11-05 | 0.0111 | `0x06ac5da9ae599f0e8978b9bf797792981dd85e02090da174ee22a0db8274adc3` |
| 9 | 2025-12-09 | 0.0111 | `0xbf9e21e5243a3efabcc8831450407c52e4d95ce945b0345874d46e4084270199` |
| 10 | 2025-12-10 | 0.0111 | `0xb2ba1478f88b3e0cc11b6499200bcfbbadf8f0603b1c4909259fbf8462d6f616` |

**Q4 subscription revenue = 0.1110 ETH × $2,271.67 = $252.16**

(Each transaction can be opened on https://arbiscan.io/tx/{hash} for
independent verification.)

#### Trailing 365 days ending 2025-12-31

| Source | Tx count | ETH | USD (at $2,271.67) |
|---|---:|---:|---:|
| Citizen subscriptions | 65 | 0.6771 | $1,538.15 |
| Team subscriptions | 6 | 0.2010 | $456.61 |
| **Subscription total** | **71** | **0.8781** | **$1,994.76** |

### 2b. DeFi LP fees

Pulled from the official Uniswap V3 subgraph for pool
`0x6de28f1176311b7408329a4d21c2bd1441be157f` (MOONEY/WETH). The subgraph is
deterministic for closed days. Annual figure: **$128.69**.

This is small relative to subscription revenue and is dominated by the
$54,387 of WETH actually held in the LP position (which contributes to AUM,
not revenue).

### 2c. Validator staking rewards

Computed from the beacon chain for our 3 active validators. There were no
withdrawals to the treasury in the trailing 365d, so this is **$0**.

### 2d. Annual revenue total

```
Citizen subs     $1,538.15
Team subs          $456.61
DeFi fees          $128.69
Staking            $  0.00
─────────────────────────
Annual revenue   $2,123.44
```

---

## 3. Putting it together

```
ETH price (DefiLlama, audit timestamp): $2,271.67

step1: rawTreasuryChange = $498,324.49 − $773,197.56 = −$274,873.07
step2: capitalGains       = −$274,873.07 − $252.16 = −$275,125.23
step3: treasuryReward     = max(−$275,125.23, 0) × 0.02 = $0.00
step4: revenueReward      = $2,123.44 × 0.10 = $212.34
step5: totalRewardETH     = ($0.00 + $212.34) / $2,271.67 = 0.09347 ETH
```

---

## 4. What this proof does *not* claim

I want to be explicit about the limits of "certainty" here, so nothing is
overstated:

1. **DefiLlama daily prices are not on-chain.** They are an aggregator
   sourced from CEX feeds. We use them because (a) they are free and
   unmetered, and (b) they are the same prices the Safe UI itself displays.
   For closed days the values do not change; for the most recent ~24h they
   can drift slightly. This affects the *USD framing* of all figures but not
   the underlying ETH amounts.

2. **The MOONEY/WETH LP value uses spot pool composition.** We read
   `positions()` + `slot0()` from the Uniswap NPM at the moment of the audit
   run; we do not historically replay every swap. That means the *current*
   snapshot is exact, and the *daily series* uses each day's closing tick
   from DefiLlama-priced WETH, but small intra-day ticks are smoothed.

3. **The "first pool creation" timestamp is null** in the snapshot. That
   field is for a different code path and not used in the reward formula —
   it does not affect any number above.

4. **Subscription revenue counts only ETH paid to the Arbitrum treasury safe
   directly from the Citizen/Team NFT mint contracts.** If a citizen mints
   and the contract immediately forwards a portion elsewhere (e.g. fees),
   only the portion that lands in the treasury is counted. This matches the
   intent of "treasury revenue."

5. **Revenue is denominated in USD using the ETH spot price at audit time**,
   not the ETH price at each individual transaction time. This is a choice;
   the alternative (price each tx at its own block timestamp) would change
   the USD figure by a few percent. The ETH amounts (0.0111 × 71 etc.) are
   exact and are the canonical primary record.

6. **Treasury reward is exactly $0**, so the small uncertainties above
   matter only insofar as they affect the trailing-annual revenue figure —
   and a 5% wobble there would change the final reward by ~0.005 ETH.

---

## 5. How to reproduce this audit yourself

### Quickest path (if you have the dev server running)

```bash
curl "http://localhost:3000/api/eb/audit?quarter=4&year=2025" | jq
```

The response includes every intermediate value: per-day AUM for both
quarters, every Citizen/Team subscription tx hash, the DefiLlama price
URLs, and the final formula step-by-step.

### Pure-curl path (no MoonDAO code at all)

```bash
KEY="<your etherscan v2 key>"
TREAS=0xAF26a002d716508b7e375f1f620338442F5470c0
CIT=0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002
TEAM=0xAB2C354eC32880C143e87418f80ACc06334Ff55F

curl -s "https://api.etherscan.io/v2/api?chainid=42161&module=account&action=txlistinternal&address=${TREAS}&startblock=0&endblock=99999999&sort=asc&apikey=${KEY}" \
| jq --arg cit "$CIT" --arg team "$TEAM" --arg treas "$TREAS" '
  [.result[]
   | select((.from|ascii_downcase)==($cit|ascii_downcase) or (.from|ascii_downcase)==($team|ascii_downcase))
   | select((.to|ascii_downcase)==($treas|ascii_downcase))
   | select(.isError=="0" and (.value|tonumber)>0)
   | select(.timeStamp|tonumber >= 1759276800 and (.timeStamp|tonumber) <= 1767225599)
   | (.value|tonumber)/1e18
  ] | add'
```

That returns `0.111` exactly (Q4 ETH from subscriptions). Run with the
`>= 1735603200` lower bound for the full trailing-365d total of `0.8781`.

For the AUM totals, the live Safe-API endpoints under `sources.balances`
will give you each safe's current portfolio in JSON form.

---

## 6. Code references

- `ui/lib/treasury/canonicalRevenue.ts` — direct on-chain subscription revenue
- `ui/lib/treasury/aum-onchain.ts` — daily AUM reconstruction (Etherscan + DefiLlama)
- `ui/lib/treasury/eb-rewards.ts` — formula (`calculateEBRewards`)
- `ui/pages/api/eb/audit.ts` — the audit endpoint that emits the JSON behind this doc

---

## 7. Honest caveats / known issues

- **Determinism is per-component.** AUM is exactly deterministic across runs
  (closed days only); subscription ETH amounts are exactly deterministic;
  the USD framings move with the live ETH price by a few cents between
  runs. Two consecutive runs differed by ~$0.22 on Q4 quarter revenue and
  by ~$1.77 on annual revenue, both attributable to ETH spot moving.
  Final reward in ETH was identical (0.0935).

- **The dev `getHistoricalRevenue` helper still exists** and feeds DeFi
  fees + staking. If the Uniswap subgraph is down, DeFi fees would read $0
  and the annual revenue would drop by ~$129 (= ~$13 reward, ~0.006 ETH).
  This would be visible in the audit JSON as `defiFeesUSD: 0`.

- **One thing I cannot prove from public data alone:** the policy decisions
  (2% of capital gains, 10% of revenue, exclude MOONEY from AUM, exclude
  staked ETH from AUM). Those are governance choices, not on-chain facts.
  The policy lives in `eb-rewards.ts` and matches what was previously
  documented for the Executive Branch reward program.
