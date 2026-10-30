# Public Touchdown — 2026-10-27 deploy

Broadcast from deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`.
Do not invent addresses. The Arbitrum market was seeded on 30 Oct 2026.
The executive Safe still has to register and open it.

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
Until it lands, the hook treats every Juicebox pay, including each bet's 5%
slice, as a plain launchpad contribution: 2.5% goes to the TreasuryPayHook
and tokens mint at 97.5% weight. Latch before the first bet.

Previous registry `0x7208B0Ba9B1013000b8D30b60A462079300984E2` still holds
the earlier Touchdown generations and Night Shift (3), First Tracks (5) and
Water Ice (6). The app reads one registry per chain, so after this cutover
those three Sepolia races are not on the new registry.

Forecasts on Sepolia are keyed by prize id. One zero-power row from the old
id 1 (`{"5":100}`, Open Field on the 6-slot roster) now reads as ispace.

## Arbitrum One (chain 42161) — market seeded, not open

Broadcast 30 Oct 2026 from deployer `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`.
The app still reads the live UUPS registry
`0xf8B2244634c6eCeF32de10BFe0D7436413A59924`. Switch that pointer only after
the Safe batch below has opened id 1. This registry's `count()` is still 0.

| Slot | Value | Notes |
|---|---|---|
| DePrizeRegistry | `0x5620749d0579ff08D0DD2389CF9040523DD7B8ea` | Owner = executive Safe `0xdFc31084ad3887076913e5d0759a27C65A3C5291`. Tx `0x3f0b5468…3eeed6`, block **518890846** |
| DePrizeMint | `0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765` | Same owner. `complianceSigner` is unset. Tx `0xd7af60bc…2176d9a`, block **518890870** |
| DePrizeRedeem | `0x0aeB11c3527DBa0f1081c17C597582DF86E47F06` | Tx `0x052b00ef…14d4187`, block **518890892** |
| MissionCreator | `0x6dB622369C46F9480915AE8394e6202C000D7CFb` | Deployer-owned. Tx `0xe08b2c1a…d4e2cd6`, block **518890970** |
| TreasuryPayHook | `0x75e5441984Ac6850733425cb502d6ec77C79BACa` | Treasury `0xAF26a002d716508b7e375f1f620338442F5470c0` |
| MissionTable | `0xA4cdEEACE0837292C20B3e904255c9846Ec8856B` | Fresh `DEPRIZEMISSION`. Owner = executive Safe |
| question | `deprize:arbitrum:touchdown-public:v1` | |
| questionId | `0xd81ff517bc437933758e3679c1107fca6983ca98f2798926af562ab5bdf4b32e` | |
| conditionId | `0x74903435e83c31673d67ceb23e243c99f4a95d0fe451ad2a62d5f4221ae532fa` | Oracle = treasury. 7 slots, unresolved. Tx `0x2ff2b7d3…a9f9602` |
| market | `0x8dD77065A0934F3Cea5c7b8d58e9F5A966B1Da2d` | H-01 `createLMSRWithTWAP`, fee `2e16`, funding 0.056 ETH, stage running. Owner = executive Safe. Tx `0x75ef5fcf…7b10256`, ownership `0xa1ceadb2…726b286` |
| jbProjectId | `87` | missionId `0`. Tx `0xe9eb0709…0e3a5098` |
| payHook | `0xC3051321c106aeEc0926b18084eEfDE073041614` | Owner = executive Safe. `deprizeRegistry` is still unset |
| sunset | `1856458310` | 29 Oct 2028, 11:51 AM PDT |
| roster | `[601, 602, 603, 604, 605, 606, 24]` | |

The executive Safe is 3 of 5 on chain. The deployer is not an owner.
Registry `count()` is 0, so `register` returns id 1. The six calls below are
one transaction, in this order. `open` is last.

An executive Safe owner runs this on their own machine, from `ui/` on
`cursor/arbitrum-touchdown-market-8042`. No GCP credentials and no Safe Pro
plan. Their key adds the HSM `0xb206325E6562517532686dFeeEaD4C104D9F5d32` as a
proposer and queues the batch. That signature counts as one of three.

```
cd ui && yarn
SAFE_OWNER_PK=0x<executive-safe-owner> \
  yarn tsx --tsconfig tsconfig.json scripts/propose-touchdown-arbitrum-safe.ts
```

The script refuses to run if the registry count is no longer 0.
`setComplianceSigner` uses the address of the local
`DEPRIZE_COMPLIANCE_SIGNER_KEY`, which is the deployer. Confirm production
signs with that key before executing.

1. `0xC3051321c106aeEc0926b18084eEfDE073041614` `setDePrizeRegistry`
   `0x14c413ea0000000000000000000000005620749d0579ff08d0dd2389cf9040523dd7b8ea`
2. `0x5620749d0579ff08D0DD2389CF9040523DD7B8ea` `register(87, [601–606, 24], 1856458310)`
   `0x1970b05a00000000000000000000000000000000000000000000000000000000000000570000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000006ea74e4600000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000259000000000000000000000000000000000000000000000000000000000000025a000000000000000000000000000000000000000000000000000000000000025b000000000000000000000000000000000000000000000000000000000000025c000000000000000000000000000000000000000000000000000000000000025d000000000000000000000000000000000000000000000000000000000000025e0000000000000000000000000000000000000000000000000000000000000018`
3. `0x5620749d0579ff08D0DD2389CF9040523DD7B8ea` `setCondition(1, conditionId)`
   `0x87c357a3000000000000000000000000000000000000000000000000000000000000000174903435e83c31673d67ceb23e243c99f4a95d0fe451ad2a62d5f4221ae532fa`
4. `0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765` `setMarket(1, market)`
   `0xf4b2ad1400000000000000000000000000000000000000000000000000000000000000010000000000000000000000008dd77065a0934f3cea5c7b8d58e9f5a966b1da2d`
5. `0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765` `setComplianceSigner(deployer)`
   `0x73fe79440000000000000000000000003c5e2fe76478e99d94d3ca8bfa5154907a52e011`
6. `0x5620749d0579ff08D0DD2389CF9040523DD7B8ea` `open(1)`
   `0x690e7c090000000000000000000000000000000000000000000000000000000000000001`

Do not broadcast the provision script again. The spec records the mission and
market, and a re-run skips both. A second market would take another 0.056 ETH.
