# DePrize Arbitrum — address ledger

Live values for Arbitrum One (chain id 42161). These are the source of truth for
`ui/const/config.ts` and `fee-hook/script/base/Config.sol`. **Do not invent addresses.**

## Shared infrastructure (Phase 2 — deploy once, reused by every DePrize)

| Slot | Value | Notes |
|---|---|---|
| WETH (canonical aeWETH) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | Do not deploy WETH9. Pre-flight: `ArbitrumWethPreflight`. |
| ConditionalTokens | `0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29` | Gnosis CTF, solc 0.5.1 |
| Fixed192x64Math | `0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b` | library linked into the factory |
| LMSRWithTWAPFactory | `0xb40d77bD8C3D8CF38c4b88D649D397efa2dd2cB8` | |

## DePrize 0.8 stack (Phase 3 — deploy once)

| Slot | Value | Notes |
|---|---|---|
| DePrizeRegistry proxy | `0xf8B2244634c6eCeF32de10BFe0D7436413A59924` | owner = deployer EOA |
| DePrizeMint proxy | `0xfa36cAb21415B4e23a1eecCFe7B07693A690d838` | |
| DePrizeRedeem | `0xb0E06ed72cf6E0CcF21b4D00B002fdfDc198C3fA` | |
| DePrizeFeeRouter | `0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1` | owns each LMSR market |
| MissionCreator (new) | `0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B` | **Not** production `0x87e80c…`. Registry-aware pay hooks. |
| MissionTable (DePrize-only) | `0xC27f44B81057242140DB1a4eE4ADf02b1E193C87` | Fresh `DEPRIZEMISSION` table; missions here do **not** appear in the main launchpad list. |

## DePrize 1 — "The Moon is a harsh mistress" (2026-08-25)

Internal end-to-end competition. Resolves to whichever listed team first posts
the exact phrase "The Moon is a harsh mistress" from its official X account.

| Slot | Value | Notes |
|---|---|---|
| `deprizeId` | `1` | registry ids start at 1 |
| Competing teams | `[2, 6, 7, 8]` | LifeShip, Intuitive Machines, The Mars Society, Space for Humanity — placeholders |
| JB project id | `82` | missionId `0` on the new MissionCreator |
| LaunchPadPayHook | `0x66bbcf85E8D3de5Af319D2c0C1Dcb6672D9751Fb` | latched to the registry (one-way, done) |
| `questionId` | `0xc3efda478f2465a1d402bfe9bc43fd04660daa72d0a71031594b341f2718adb9` | **Not on-chain.** Losing this blocks `reportPayouts`. |
| `conditionId` | `0xdbd19e7f5ebc04e7aa5cecc95b9ccd2bbb2609d25203246a889f7b03db7e71c0` | 4 outcome slots |
| LMSRWithTWAP market | `0x351aF5AcfBC4Df750B7BD58b4c4cbE94147aF211` | 0.04 ETH seed, 1% fee, owned by the FeeRouter |
| Oracle | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` | deployer EOA — immutable inside `conditionId` |
| Sunset | `1788222792` | 2026-09-01 00:33 UTC; extend-only while OPEN |

### Deriving the conditionId

`conditionId = keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount))`

`encodePacked`, not `encode` — the oracle is packed as 20 bytes, not left-padded
to 32. Computing it with padded ABI encoding yields a hash that matches no
prepared condition, which reads as "condition missing" rather than as an error.
Recover the real value from the `ConditionPreparation` event's first indexed
topic if there is ever any doubt.

## Verification

`forge script script/deprize/DePrizeVerify.s.sol` (with `DEPRIZE_PAYHOOK` and
`DEPRIZE_ID` set) asserts `payHook.deprizeRegistry() == registry` and cashOut
`stage == 1`. It passed for DePrize 1 before the UI coming-soon gate was
removed; the latch is not optional.
