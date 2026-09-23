# DePrize Sepolia — v2 address ledger

Live values for Ethereum Sepolia (chain id 11155111), deployed 2026-09-18 from
`cursor/deprize-contracts-v2`. These are the source of truth for the UI
follow-up PR. **Do not invent addresses.** v1 proxies, FeeRouter and
`LMSRWithTWAP` markets stay on-chain but are out of the value path.

Owner / CTF oracle / LMSR owner / compliance signer on this testnet is the
historical Sepolia deployer EOA `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011`
(same key that owned v1). Safe ownership is the Arbitrum G4 gate, not this
dress rehearsal.

## Shared infrastructure

| Slot | Value | Notes |
|---|---|---|
| WETH | `0x8cfF28F922AeEe80d3a0663e735681469F7374c6` | Existing Sepolia test WETH |
| ConditionalTokens | `0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8` | Existing Gnosis CTF |
| Fixed192x64Math | `0x12c3f7Dc76b939A4d8Dd7Bd2a1f2d6f141191dE8` | Library linked into the stock factory. Tx `0x269c9543…0a51d`, block **11727644** |
| LMSRMarketMakerFactory | `0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674` | Unmodified Gnosis 0.5.1. Tx `0xf5799619…bfde1`, block **11727645** |
| implementationMaster | `0xd8A3b9922F23bb97deE2046fA62AAeF39f17b6ad` | Clone master created by the factory constructor |
| Juicebox V5 terminal | `0x2dB6d704058E552DeFE415753465df8dF0361846` | Shared across chains |
| MissionCreator | `0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1` | Existing DePrize-only creator |
| MissionTable | `0x0AbB0DB4CffFed867C8A94893e7cFae6ee39F807` | Existing DePrize-only table |

The v1 `LMSRWithTWAPFactory` at `0x8787Dc3c2b48b19D3Cbd25226Cd6cEAff3398de1`
must not be used to bind a v2 mint.

## DePrize 0.8 stack (immutable, no proxy)

| Slot | Value | Notes |
|---|---|---|
| DePrizeRegistry | `0x7208B0Ba9B1013000b8D30b60A462079300984E2` | `Ownable2Step`, owner = deployer. Tx `0x7c44c404…b2d25e`, block **11727650** |
| DePrizeMint | `0x22E22C4135be93595f341e072321D18e7D4Ee0D0` | EIP-712 name `DePrizeMint` / version `1`. Tx `0x472235a4…201fa0`, block **11727651** |
| DePrizeRedeem | `0x7a6B6AaC8Efbe894EDEe224a6bC3b09874c10849` | Stateless helper. Tx `0x0ad10acd…1b08d0`, block **11727653** |
| Compliance signer | `0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011` | Same as owner for this testnet. Rotate via `setComplianceSigner` if the UI key differs |

`DePrizeVerify.s.sol` passed against Touchdown (id 1) on 2026-09-18.
Registry, Mint and Redeem are verified on Sepolia Etherscan.

## Touchdown — v2 generation 1 (2026-09-18)

Replaces v1-registry DePrize **#22** (JB 268 / LMSRWithTWAP
`0x9d3b999B…`). New Juicebox mission because the #22 payhook is latched
to the v1 registry (one-way).

| Slot | Value | Notes |
|---|---|---|
| `deprizeId` | `1` | Fresh registry; ids start at 1 |
| Competing teams | `[601, 602, 603, 604, 605, 24]` | Griffin, Nova-C, Blue Ghost, Blue Moon MK1, Chang'e-7, Open Field |
| JB project id | `269` | Mission **15** on the existing MissionCreator |
| LaunchPadPayHook | `0x82B4B19232B860362B796a6f1aF06BB3BE006fFD` | Latched to the v2 registry |
| `questionId` | `0x2c633f9b1a6bd1a6252c49ed56f89d554a85e421ff84a146b1ae9e21f6311f7b` | `keccak256("deprize:sepolia:shared-next-landing:v3")`. **Not on-chain.** Losing this blocks `reportPayouts`. |
| `conditionId` | `0xda4fd1b1d84fa7a990ec7d7379f35606e6c23610c879ec60054833a39b1672c2` | 6 outcome slots; oracle = deployer |
| LMSRMarketMaker | `0x3cdC98142a9Fc1E05D22a2f39500d5DE2F290A44` | Stock Gnosis, 0.06 ETH seed (0.01 × 6), 1% fee, owner = deployer, stage Running |
| Sunset | `1852768925` | ~2 years from provision; extend-only while OPEN |

### Deriving the conditionId

`conditionId = keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount))`

`encodePacked`, not `encode`. Oracle is the deployer EOA above.

## UI follow-up PR (do not ship without both)

Point `ui/const/config.ts` at the v2 stack **and** rebind
`ui/lib/deprize/competitions.ts` in the same PR. Changing only the registry
address would make the live site read id 22 on an empty v2 registry.

```ts
// ui/const/config.ts
DEPRIZE_REGISTRY_ADDRESSES.sepolia = '0x7208B0Ba9B1013000b8D30b60A462079300984E2'
DEPRIZE_MINT_ADDRESSES.sepolia = '0x22E22C4135be93595f341e072321D18e7D4Ee0D0'
DEPRIZE_REDEEM_ADDRESSES.sepolia = '0x7a6B6AaC8Efbe894EDEe224a6bC3b09874c10849'
DEPRIZE_FEE_ROUTER_ADDRESSES.sepolia = '' // removed in v2
DEPRIZE_EVENTS_FROM_BLOCK.sepolia = 11727650
```

```ts
// ui/lib/deprize/competitions.ts  sepolia[1]
1: {
  title: 'Touchdown',
  tagline:
    'Which landing-vehicle operator lands upright on the Moon next and returns 24 hours of surface data? Back a competitor — every bet grows the prize pool.',
  metaDescription:
    'Sepolia DePrize for the next successful lunar landing. Astrobotic Griffin, Intuitive Machines, Firefly Blue Ghost, Blue Origin Blue Moon MK1, CNSA Chang’e-7, and the Open Field.',
  questionId: '0x2c633f9b1a6bd1a6252c49ed56f89d554a85e421ff84a146b1ae9e21f6311f7b',
  sharedGoalId: 'shared-next-landing',
  raceLabel: 'Next lunar landing',
  outcomes: [
    { projectId: 'astrobotic-griffin', teamId: 601, vehicleLabel: 'Griffin Mission One' },
    { projectId: 'im-nova-c', teamId: 602, vehicleLabel: 'Nova-C IM-3' },
    { projectId: 'firefly-blue-ghost', teamId: 603, vehicleLabel: 'Blue Ghost M2' },
    { projectId: 'blue-origin-blue-moon-mk1', teamId: 604, vehicleLabel: 'Blue Moon MK1' },
    { projectId: 'cnsa-change-7', teamId: 605, vehicleLabel: "Chang'e-7" },
    { projectId: OPEN_FIELD_PROJECT_ID, teamId: 24, field: true },
  ],
},
```

Mark v1-registry **#22** `supersededBy: 1` (off-chain; the v1 registry itself
is not superseded). Bets against the v2 mint need
`DEPRIZE_COMPLIANCE_SIGNER_KEY` equal to the deployer key (or rotate
`complianceSigner` to the backend key first).

## Verification

```
DEPRIZE_REGISTRY=0x7208B0Ba9B1013000b8D30b60A462079300984E2 \
DEPRIZE_MINT=0x22E22C4135be93595f341e072321D18e7D4Ee0D0 \
DEPRIZE_ID=1 \
DEPRIZE_MARKET=0x3cdC98142a9Fc1E05D22a2f39500d5DE2F290A44 \
DEPRIZE_OWNER=0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011 \
DEPRIZE_PAYHOOK=0x82B4B19232B860362B796a6f1aF06BB3BE006fFD \
DEPRIZE_JB_PROJECT=269 \
forge script script/deprize/DePrizeVerify.s.sol --rpc-url $SEPOLIA_RPC_URL
```
