# Public Touchdown — 2026-10-27 deploy

Broadcast from deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`.
Do not invent addresses. Arbitrum market seed was not sent: the deployer
had 0.0019 ETH, and `0.008 × 7 = 0.056` ETH plus gas is required.

## Sepolia (chain 11155111) — live

UI pointer cut over. `/deprize/sep/1` is this prize.

| Slot | Value | Notes |
|---|---|---|
| DePrizeRegistry | `0x342fC1Ab7CAcc71d13274D3979EAE17Cf8e93555` | Owner = deployer; `pendingOwner` = Safe `0xE5148e4399e3D849F629E0FECEcf6fC986e96127` (`acceptOwnership`). Tx `0x459da247…93736b7d`, block **12008593** |
| DePrizeMint | `0xbed33e958Bc04651cd879Fe2c5AC2175Dd938571` | Same pending Safe. Tx `0x7ef60d39…cbf9369`, block **12008594** |
| DePrizeRedeem | `0x1d6122041549a86E84CC3fc0F3b50E7c4420c4Ee` | Tx `0x6a5a363f…064fdd5a`, block **12008595** |
| MissionCreator | `0xe103fBE8a0A04d6664755aDa6D2da3D66d3c394a` | TreasuryPayHook inside. Tx `0x68115510…41ab819f`, block **12008599** |
| TreasuryPayHook | `0x0D3174BBcc124bb65f92f959C4d3645E1822866A` | 2.5% launchpad fee sink |
| MissionTable | `0x41a647F3e33E8ECF22a5A2081d44bE3524E55246` | Fresh `DEPRIZEMISSION`. Owner transferred to Safe `0xE5148e4399e3D849F629E0FECEcf6fC986e96127` |
| question | `deprize:sepolia:touchdown-public:v1` | |
| questionId | `0x630a9aa92836f37341432d49dc77b38fcf42e7537d7b5f4aee2f015c816aeb41` | |
| conditionId | `0x22a799811d0cd27383ef76b92523264933de70d3ff5a5317b61375e1b4fbe473` | Oracle = Safe `0xE5148e…6127`, 7 slots |
| market | `0xef2D94be6FccD4421085Eb4eb14B4398C77e58c7` | Stock LMSR, fee `2e16`, owner = Safe |
| jbProjectId | `281` | missionId `0` |
| payHook | `0x1C0cfebeeA9A147C6e28E0dc37230De81E7A33E0` | Owner = Safe. `setDePrizeRegistry` still needs the Safe |
| deprizeId | `1` | OPEN. Roster `[601, 602, 603, 604, 605, 606, 24]` |
| seed | 0.056 ETH | 0.008 ETH × 7 |
| sunset | `1856217894` | |
| compliance signer | deployer | |

A stale MissionCreator from an outdated artifact sits at
`0x782C5077fA195316DbD0728582AebD917B613E52` and is unused.

Safe still has to call `payHook.setDePrizeRegistry(registry)` (write-once).
Betting through DePrizeMint works without that latch; Juicebox pays do not
become DePrize-aware until it lands.

Previous registry `0x7208B0Ba9B1013000b8D30b60A462079300984E2` still holds
the earlier Touchdown generations. The app no longer points at it.

## Arbitrum One (chain 42161) — contracts only

UI pointer stays on the live UUPS registry
`0xf8B2244634c6eCeF32de10BFe0D7436413A59924` until the market is seeded.

| Slot | Value | Notes |
|---|---|---|
| DePrizeRegistry | `0x5620749d0579ff08D0DD2389CF9040523DD7B8ea` | Constructor owner = executive Safe `0xdFc31084ad3887076913e5d0759a27C65A3C5291`. Tx `0x3f0b5468…3eeed6`, block **518890846** |
| DePrizeMint | `0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765` | Same owner. Tx `0xd7af60bc…2176d9a`, block **518890870** |
| DePrizeRedeem | `0x0aeB11c3527DBa0f1081c17C597582DF86E47F06` | Tx `0x052b00ef…14d4187`, block **518890892** |
| MissionCreator | `0x6dB622369C46F9480915AE8394e6202C000D7CFb` | Deployer-owned so it can `createMission`. Tx `0xe08b2c1a…d4e2cd6`, block **518890970** |
| TreasuryPayHook | `0x75e5441984Ac6850733425cb502d6ec77C79BACa` | Treasury `0xAF26a002d716508b7e375f1f620338442F5470c0` |
| MissionTable | `0xA4cdEEACE0837292C20B3e904255c9846Ec8856B` | Fresh `DEPRIZEMISSION`. Owner transferred to executive Safe |
| factory | `0x299F163705AbBFa1A8DE7670F33171730F828F3D` | H-01 `createLMSRWithTWAP` |
| question | `deprize:arbitrum:touchdown-public:v1` | |

Spec with these addresses: `ui/scripts/races/touchdown-public.json`.
Re-run after the deployer holds ≥ 0.106 ETH:

```
CONFIRM=arbitrum node ui/scripts/provision-touchdown-arbitrum-public.cjs ui/scripts/races/touchdown-public.json
```

Register / setCondition / setMarket / open / `setDePrizeRegistry` are Safe
calls. The deployer cannot send them on this registry.
