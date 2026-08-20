# DePrize Arbitrum — address ledger

Fill this in as Phases 2–5 land. Values here are the source of truth for the
follow-up config PR (plan 1.5 + Phase 6). **Do not invent addresses.**

| Slot | Value | Phase | Notes |
|---|---|---|---|
| WETH (canonical aeWETH) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | known | Do not deploy WETH9. Pre-flight: `ArbitrumWethPreflight`. |
| ConditionalTokens | _pending Phase 2_ | 2 | `npx truffle migrate -f 2 --to 4 --network arbitrum` |
| LMSRWithTWAPFactory | _pending Phase 2_ | 2 | same migrate |
| MissionCreator (new) | _pending Phase 3.1_ | 3 | **Not** production `0x87e80c…`. Decide listings vs DePrize-only. |
| MissionTable (DePrize-only) | _pending Phase 3.1_ | 3 | Fresh table from `MissionCreator.s.sol` default. Production table only if `DEPRIZE_USE_PRODUCTION_MISSION_TABLE` + `setMissionCreator` before 3.2. |
| JB project id | _pending Phase 3.2_ | 3 | `CreateDePrizeMission.s.sol` |
| LaunchPadPayHook | _pending Phase 3.2_ | 3 | latch owner = `MISSION_TO` |
| DePrizeRegistry proxy | _pending Phase 3.3_ | 3 | `DePrizeRegistry.s.sol` — record **proxy**, not impl |
| DePrizeRegistry impl | | 3 | |
| DePrizeMint proxy | _pending Phase 3.4_ | 3 | |
| DePrizeRedeem | _pending Phase 3.5_ | 3 | |
| DePrizeFeeRouter | _pending Phase 3.6_ | 3 | |
| `questionId` | _pending Phase 0.6 / 4_ | 4 | **Not on-chain.** Losing this blocks `reportPayouts`. |
| `conditionId` | _pending Phase 4_ | 4 | `keccak256(oracle, questionId, numOutcomes)` |
| LMSRWithTWAP market | _pending Phase 4_ | 4 | |
| `deprizeId` | _pending Phase 5.1_ | 5 | starts at 1 |
| Admin Safe / oracle | _pending Phase 0.4_ | 0 | Irreversible in `conditionId` |

After Phase 5, `forge script script/deprize/DePrizeVerify.s.sol` must pass
(with `DEPRIZE_PAYHOOK` set) before flipping the UI coming-soon gate. A
passing run asserts `payHook.deprizeRegistry() == registry` and cashOut
`stage == 1`; the latch is not optional.
