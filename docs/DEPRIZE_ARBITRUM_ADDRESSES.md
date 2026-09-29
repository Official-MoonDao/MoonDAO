# DePrize Arbitrum — address ledger

Live values for Arbitrum One (chain id 42161). These are the source of truth for
`ui/const/config.ts` and `fee-hook/script/base/Config.sol`. **Do not invent addresses.**
Sepolia v2 (the dress rehearsal) is in [`DEPRIZE_SEPOLIA_ADDRESSES.md`](./DEPRIZE_SEPOLIA_ADDRESSES.md).

## Shared infrastructure (Phase 2 — deploy once, reused by every DePrize)

| Slot | Value | Notes |
|---|---|---|
| WETH (canonical aeWETH) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | Do not deploy WETH9. Pre-flight: `ArbitrumWethPreflight`. |
| ConditionalTokens | `0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29` | Gnosis CTF, solc 0.5.1 |
| Fixed192x64Math | `0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b` | library linked into the factory |
| LMSRWithTWAPFactory (Phase 2, **do not use**) | `0xb40d77bD8C3D8CF38c4b88D649D397efa2dd2cB8` | Clones the pre-H-01 implementation `0x7473ef3d…190c` |
| LMSRWithTWAPFactory (H-01, 2026-09-11) | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` | Fixed `implementationMaster` `0xF9a3A691dF3568B0822EdA56914C2165087831e5`. Same 20-byte value as the Sepolia registry — different chain. |

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
| LMSRWithTWAP market (H-01) | `0xB7fE1530D300C505295B42268e127ceea5aDe703` | 0.04 ETH seed, 1% fee, owned by the FeeRouter. Same `conditionId` as the disposable pre-fix clone `0x351aF5…F211`. |
| Oracle | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` | deployer EOA — immutable inside `conditionId` |
| Sunset | `1788222792` | 2026-09-01 00:33 UTC; extend-only while OPEN |

### Deriving the conditionId

`conditionId = keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount))`

`encodePacked`, not `encode` — the oracle is packed as 20 bytes, not left-padded
to 32. Computing it with padded ABI encoding yields a hash that matches no
prepared condition, which reads as "condition missing" rather than as an error.
Recover the real value from the `ConditionPreparation` event's first indexed
topic if there is ever any doubt.

## Capability races (2026-09-25)

The four races that are open on Sepolia, registered on the Arbitrum 0.8 stack.
Same roster order and team ids as `ui/lib/deprize/competitions.ts` on Sepolia.
Oracle for every condition is the deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`.
Each market is an H-01 `LMSRWithTWAP` clone, 1% fee, owned by the FeeRouter.
Question ids are `keccak256("deprize:arbitrum:<goalId>:v1")`.

Touchdown, Night Shift, and First Tracks were seeded at 0.008 ETH per outcome.
Water Ice was seeded at 0.003 ETH per outcome: after the first three Juicebox
missions, the deployer no longer held 0.008 ETH × 4.

| | Touchdown | Night Shift | First Tracks | Water Ice |
|---|---|---|---|---|
| `deprizeId` | `2` | `3` | `4` | `5` |
| Goal | `shared-next-landing` | `shared-night-shift` | `shared-first-tracks` | `shared-ice` |
| Teams | `[601, 602, 603, 604, 605, 24]` | `[611–617, 24]` | `[631–635, 24]` | `[641, 642, 643, 24]` |
| Slots | 6 | 8 | 6 | 4 |
| JB project | `83` | `84` | `85` | `86` |
| Mission id | `1` | `2` | `3` | `4` |
| Pay hook | `0xbc87EeEC3924C4B3F98872729Db337A8964B7290` | `0xf4A35695c79515B727930b5e5B44a69C4B6b4677` | `0xBdf27D7175B66c2e35c10cB49474AA4345BC4112` | `0xC65989020E2FfCB99EDb199d491dcd201B3BB75c` |
| `questionId` | `0xd4daf3cb8f7f228cdf16c58c2e4345742bf4d1e58d7ebc271c0a533621262efc` | `0x75be567e6161e270124d3eed4627ecee60fb1fc138e005517fed91cdaeca8602` | `0x18e1c3d9d40fbccaaa147e0736917bff8f1eb3bd0a1f5ebc6f16c70fe4e9b396` | `0xc97585bf11fff6b53bdddcd58e4518c02253f616c86eafc2962f3a3801333e15` |
| `conditionId` | `0x94e781cb27fa9a40ef2d2294d663ee4928d78f85a7bfdaf403646bd9e7ee435a` | `0x322a47ed20c049cc32d40ef96851d42bc1138f9d40035a54bdc5d78cb7ec2b5f` | `0x931742a3eb2e3945c6ec75ae34749bd5af01bf47a71291b71d5b21ff861a43e5` | `0xdf330434279872f515adc74ff3d845a19490af3e219bcba352ec48ac3e754f22` |
| Market | `0x690917308821a9d02512cDC7859145cd07e904d0` | `0xfb1196F836a55Cde5889D0CCdC604b6Bb2022ED7` | `0x16d02C863E82D6efea67fCE3098dab0A3021b4ff` | `0x9F62BC2a4E603B3B4e1Ad34Dd4532dd028CfeB0d` |
| Seed | 0.048 ETH | 0.064 ETH | 0.048 ETH | 0.012 ETH |
| Sunset | `1853460055` (2028-09-25 02:00:55 UTC) | `1853460085` (2028-09-25 02:01:25 UTC) | `1853460085` | `1853460085` |

Provision script: `ui/scripts/provision-arbitrum-races.cjs`. Re-running it skips a goal that is already verified in `/tmp/arbitrum-capability-races.json`.

## H-01 factory + Sepolia live market (2026-09-11)

Redeployed from the fixed `LMSRWithTWAP` source. New markets must come from
these factories. The Phase 2 / pre-fix clones remain on-chain and drainable.

| Slot | Value |
|---|---|
| Sepolia Fixed192x64Math | `0x6313E1842BbF02b6c986A49Ee8330168138D4c35` |
| Sepolia LMSRWithTWAPFactory | `0x18778032c44Cd0a7dF81eF9bF3f5aF1b03471a7a` |
| Sepolia implementationMaster | `0xcab27aC55281333Aa8506F8e27Db4B6F61C938C2` |
| Sepolia Touchdown (#22) market | `0xC717D9ac121E2f7882f007FA046009501Fe0B43C` |
| Sepolia Harsh Mistress (#20) market | `0x726bF651B9Ff3ff19e99491EB7E5Ec363a06bb37` |

## Verification

`forge script script/deprize/DePrizeVerify.s.sol` (with `DEPRIZE_PAYHOOK` and
`DEPRIZE_ID` set) asserts `payHook.deprizeRegistry() == registry` and cashOut
`stage == 1`. It passed for DePrize 1 before the UI coming-soon gate was
removed; the latch is not optional.
