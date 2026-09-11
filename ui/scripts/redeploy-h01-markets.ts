/**
 * Redeploy H-01-fixed LMSR markets on Sepolia and Arbitrum.
 *
 * The live factories still mint clones of the vulnerable implementation.
 * This script:
 *   1. deploys a new LMSRWithTWAPFactory (constructor deploys the fixed master)
 *   2. creates a replacement market on each existing CTF condition
 *   3. rebinds DePrizeMint + DePrizeFeeRouter and hands LMSR ownership over
 *
 * Compile first (Node 18/20):
 *   cd ../prediction && npm run truffle -- compile
 *
 *   source ../prediction/.env   # PRIVATE_KEY
 *   yarn tsx --tsconfig tsconfig.json scripts/redeploy-h01-markets.ts
 *   CHAINS=sepolia yarn tsx --tsconfig tsconfig.json scripts/redeploy-h01-markets.ts
 *   CHAINS=arbitrum yarn tsx --tsconfig tsconfig.json scripts/redeploy-h01-markets.ts
 *
 * Optional: DEPRIZE_FACTORY=0x... skips factory deploy and only rebinds markets.
 * Optional: DEPRIZE_IDS=22,20 limits which DePrizes are rebound.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  formatEther,
  type Abi,
  type Chain,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum, sepolia } from 'viem/chains'

const ZERO = '0x0000000000000000000000000000000000000000' as const
const FEE = 10_000_000_000_000_000n
const MATH_PLACEHOLDER = '__Fixed192x64Math_______________________'
const PREDICTION_BUILD = resolve(
  fileURLToPath(new URL('../../prediction/build/contracts', import.meta.url))
)

const factoryAbi = parseAbi([
  'function implementationMaster() view returns (address)',
  'function createLMSRWithTWAP(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
  'event LMSRWithTWAPCreation(address indexed creator, address lmsrWithTWAP, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
])

const mintAbi = parseAbi([
  'function owner() view returns (address)',
  'function setMarket(uint256 deprizeId, address market)',
  'function marketOf(uint256 deprizeId) view returns (address)',
])

const feeAbi = parseAbi([
  'function owner() view returns (address)',
  'function setMarket(uint256 deprizeId, address market)',
  'function marketOf(uint256 deprizeId) view returns (address)',
])

const registryAbi = [
  {
    type: 'function',
    name: 'getDePrize',
    stateMutability: 'view',
    inputs: [{ name: 'deprizeId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'jbProjectId', type: 'uint256' },
          { name: 'ctfConditionId', type: 'bytes32' },
          { name: 'sunset', type: 'uint256' },
          { name: 'winningTeamId', type: 'uint256' },
          { name: 'cancellationNoticeAt', type: 'uint256' },
          { name: 'state', type: 'uint8' },
          { name: 'teamIds', type: 'uint256[]' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'count',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const lmsrAbi = parseAbi([
  'function owner() view returns (address)',
  'function funding() view returns (uint256)',
  'function stage() view returns (uint8)',
  'function fee() view returns (uint64)',
  'function atomicOutcomeSlotCount() view returns (uint256)',
  'function conditionIds(uint256) view returns (bytes32)',
  'function transferOwnership(address newOwner)',
])

const wethAbi = parseAbi([
  'function deposit()',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])

type ChainSpec = {
  slug: string
  chain: Chain
  rpcEnv: string[]
  fallbackRpc: string
  mint: Hex
  feeRouter: Hex
  registry: Hex
  ctf: Hex
  weth: Hex
  existingMath?: Hex
  defaultIds: number[]
}

const CHAINS: Record<string, ChainSpec> = {
  sepolia: {
    slug: 'sepolia',
    chain: sepolia,
    rpcEnv: ['SEPOLIA_RPC_URL', 'SEPOLIA_RPC'],
    fallbackRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    mint: '0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8',
    feeRouter: '0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a',
    registry: '0x299F163705AbBFa1A8DE7670F33171730F828F3D',
    ctf: '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8',
    weth: '0x8cfF28F922AeEe80d3a0663e735681469F7374c6',
    defaultIds: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  },
  arbitrum: {
    slug: 'arbitrum',
    chain: arbitrum,
    rpcEnv: ['ARBITRUM_RPC_URL'],
    fallbackRpc: 'https://arb1.arbitrum.io/rpc',
    mint: '0xfa36cAb21415B4e23a1eecCFe7B07693A690d838',
    feeRouter: '0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1',
    registry: '0xf8B2244634c6eCeF32de10BFe0D7436413A59924',
    ctf: '0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    existingMath: '0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b',
    defaultIds: [1],
  },
}

function pk(): Hex {
  const raw = process.env.PRIVATE_KEY || process.env.DEPLOYER_PK
  if (!raw) throw new Error('Set PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

function rpcUrl(spec: ChainSpec): string {
  for (const key of spec.rpcEnv) {
    const value = process.env[key]
    if (value) return value
  }
  return spec.fallbackRpc
}

function selectedChains(): ChainSpec[] {
  const raw = (process.env.CHAINS || 'sepolia,arbitrum')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return raw.map((name) => {
    const spec = CHAINS[name]
    if (!spec) throw new Error(`Unknown chain ${name}`)
    return spec
  })
}

function selectedIds(spec: ChainSpec): number[] {
  if (!process.env.DEPRIZE_IDS) return spec.defaultIds
  return process.env.DEPRIZE_IDS.split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

function loadArtifact(name: string): { abi: Abi; bytecode: Hex } {
  const json = JSON.parse(readFileSync(resolve(PREDICTION_BUILD, `${name}.json`), 'utf8'))
  if (typeof json.bytecode !== 'string' || !json.bytecode.startsWith('0x')) {
    throw new Error(`${name} artifact missing bytecode — compile prediction/ first`)
  }
  return { abi: json.abi, bytecode: json.bytecode as Hex }
}

function linkFixedMath(bytecode: Hex, library: Hex): Hex {
  const addr = library.slice(2).toLowerCase()
  if (addr.length !== 40) throw new Error(`bad library ${library}`)
  const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode
  if (!hex.includes(MATH_PLACEHOLDER)) {
    // Already linked to this library, or compiled with libraries set.
    if (hex.toLowerCase().includes(addr)) return (`0x${hex}`) as Hex
    throw new Error('factory bytecode has no Fixed192x64Math placeholder')
  }
  const linked = hex.split(MATH_PLACEHOLDER).join(addr)
  if (linked.includes('__')) {
    throw new Error(`unlinked placeholders remain in factory bytecode`)
  }
  return (`0x${linked}`) as Hex
}

function implFromClone(code: Hex | undefined): Hex | null {
  const hex = (code || '0x').replace(/^0x/i, '').toLowerCase()
  if (hex.startsWith('363d3d373d3d3d363d73') && hex.includes('5af43d82803e903d91602b57fd5bf3')) {
    return (`0x${hex.slice(20, 60)}`) as Hex
  }
  return null
}

async function main() {
  const account = privateKeyToAccount(pk())
  const results: Record<string, unknown> = { deployer: account.address }

  for (const spec of selectedChains()) {
    const rpc = rpcUrl(spec)
    const publicClient = createPublicClient({
      chain: spec.chain,
      transport: http(rpc, { timeout: 120_000 }),
    })
    const wallet = createWalletClient({
      account,
      chain: spec.chain,
      transport: http(rpc, { timeout: 120_000 }),
    })

    const sendTx = async (hash: Hex) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error(`tx reverted ${hash}`)
      return receipt
    }

    console.log(`\n=== ${spec.slug} ===`)
    console.log('deployer', account.address)
    const eth = await publicClient.getBalance({ address: account.address })
    console.log('ETH', formatEther(eth))

    const mintOwner = await publicClient.readContract({
      address: spec.mint,
      abi: mintAbi,
      functionName: 'owner',
    })
    const feeOwner = await publicClient.readContract({
      address: spec.feeRouter,
      abi: feeAbi,
      functionName: 'owner',
    })
    if (mintOwner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`${spec.slug} mint owner is ${mintOwner}, not the deployer`)
    }
    if (feeOwner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`${spec.slug} fee router owner is ${feeOwner}, not the deployer`)
    }

    let factory = (process.env.DEPRIZE_FACTORY || '') as Hex | ''
    let math = (process.env.DEPRIZE_MATH || spec.existingMath || '') as Hex | ''

    if (!factory) {
      if (!math) {
        const mathArtifact = loadArtifact('Fixed192x64Math')
        console.log('deploying Fixed192x64Math')
        const mathHash = await wallet.deployContract({
          abi: mathArtifact.abi,
          bytecode: mathArtifact.bytecode,
        })
        const mathReceipt = await sendTx(mathHash)
        if (!mathReceipt.contractAddress) throw new Error('math deploy produced no address')
        math = mathReceipt.contractAddress
        console.log('  Fixed192x64Math', math)
      } else {
        console.log('reuse Fixed192x64Math', math)
      }

      const factoryArtifact = loadArtifact('LMSRWithTWAPFactory')
      const bytecode = linkFixedMath(factoryArtifact.bytecode, math)
      console.log('deploying LMSRWithTWAPFactory')
      const factoryHash = await wallet.deployContract({
        abi: factoryArtifact.abi,
        bytecode,
      })
      const factoryReceipt = await sendTx(factoryHash)
      if (!factoryReceipt.contractAddress) throw new Error('factory deploy produced no address')
      factory = factoryReceipt.contractAddress
    }

    const impl = await publicClient.readContract({
      address: factory,
      abi: factoryAbi,
      functionName: 'implementationMaster',
    })
    const implCode = await publicClient.getCode({ address: impl })
    console.log('factory', factory)
    console.log('implementationMaster', impl)
    console.log('implRuntimeHexChars', (implCode || '0x').length - 2)

    const ids = selectedIds(spec)
    const created: Array<Record<string, string>> = []
    let needWeth = 0n

    const plans: Array<{
      id: number
      condition: Hex
      funding: bigint
      slots: bigint
      oldMarket: Hex
    }> = []

    for (const id of ids) {
      const oldMarket = await publicClient.readContract({
        address: spec.mint,
        abi: mintAbi,
        functionName: 'marketOf',
        args: [BigInt(id)],
      })
      if (oldMarket === ZERO) {
        console.log(`  skip #${id} — no market bound`)
        continue
      }
      const deprize = await publicClient.readContract({
        address: spec.registry,
        abi: registryAbi,
        functionName: 'getDePrize',
        args: [BigInt(id)],
      })
      const [funding, stage, slots, marketCondition] = await Promise.all([
        publicClient.readContract({ address: oldMarket, abi: lmsrAbi, functionName: 'funding' }),
        publicClient.readContract({ address: oldMarket, abi: lmsrAbi, functionName: 'stage' }),
        publicClient.readContract({
          address: oldMarket,
          abi: lmsrAbi,
          functionName: 'atomicOutcomeSlotCount',
        }),
        publicClient.readContract({
          address: oldMarket,
          abi: lmsrAbi,
          functionName: 'conditionIds',
          args: [0n],
        }),
      ])
      if (stage !== 0) {
        console.log(`  skip #${id} — LMSR stage ${stage}`)
        continue
      }
      if (marketCondition.toLowerCase() !== deprize.ctfConditionId.toLowerCase()) {
        throw new Error(
          `#${id} market condition ${marketCondition} != registry ${deprize.ctfConditionId}`
        )
      }
      if (slots !== BigInt(deprize.teamIds.length)) {
        throw new Error(`#${id} slots ${slots} != teams ${deprize.teamIds.length}`)
      }
      const oldCode = await publicClient.getCode({ address: oldMarket })
      const oldImpl = implFromClone(oldCode)
      if (oldImpl && oldImpl.toLowerCase() === impl.toLowerCase()) {
        console.log(`  skip #${id} — already on fixed implementation ${impl}`)
        continue
      }
      console.log(
        `  plan #${id} funding=${formatEther(funding)} ETH condition=${marketCondition} old=${oldMarket}`
      )
      plans.push({
        id,
        condition: marketCondition,
        funding,
        slots,
        oldMarket,
      })
      needWeth += funding
    }

    if (plans.length === 0) {
      results[spec.slug] = { factory, impl, markets: [] }
      continue
    }

    const gasPad = spec.slug === 'arbitrum' ? 10n ** 16n : 2n * 10n ** 17n
    const required = needWeth + gasPad
    if (eth < required) {
      throw new Error(
        `${spec.slug} needs ~${formatEther(required)} ETH (seeds ${formatEther(needWeth)} + gas), has ${formatEther(eth)}`
      )
    }

    const wethBal = await publicClient.readContract({
      address: spec.weth,
      abi: wethAbi,
      functionName: 'balanceOf',
      args: [account.address],
    })
    if (wethBal < needWeth) {
      const wrap = needWeth - wethBal
      console.log('wrap WETH', formatEther(wrap))
      await sendTx(
        await wallet.writeContract({
          address: spec.weth,
          abi: wethAbi,
          functionName: 'deposit',
          value: wrap,
        })
      )
    }
    console.log('approve factory', formatEther(needWeth))
    await sendTx(
      await wallet.writeContract({
        address: spec.weth,
        abi: wethAbi,
        functionName: 'approve',
        args: [factory, needWeth],
      })
    )

    for (const plan of plans) {
      console.log(`creating #${plan.id} …`)
      const receipt = await sendTx(
        await wallet.writeContract({
          address: factory,
          abi: factoryAbi,
          functionName: 'createLMSRWithTWAP',
          args: [spec.ctf, spec.weth, [plan.condition], FEE, ZERO, plan.funding],
        })
      )
      let market: Hex | undefined
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({
            abi: factoryAbi,
            data: log.data,
            topics: log.topics,
          })
          if (parsed.eventName === 'LMSRWithTWAPCreation') {
            market = (parsed.args as { lmsrWithTWAP: Hex }).lmsrWithTWAP
          }
        } catch {
          /* not this event */
        }
      }
      if (!market) throw new Error(`#${plan.id} missing LMSRWithTWAPCreation`)

      await sendTx(
        await wallet.writeContract({
          address: spec.mint,
          abi: mintAbi,
          functionName: 'setMarket',
          args: [BigInt(plan.id), market],
        })
      )
      await sendTx(
        await wallet.writeContract({
          address: spec.feeRouter,
          abi: feeAbi,
          functionName: 'setMarket',
          args: [BigInt(plan.id), market],
        })
      )
      await sendTx(
        await wallet.writeContract({
          address: market,
          abi: lmsrAbi,
          functionName: 'transferOwnership',
          args: [spec.feeRouter],
        })
      )

      const [boundMint, boundFee, owner, cloneImpl] = await Promise.all([
        publicClient.readContract({
          address: spec.mint,
          abi: mintAbi,
          functionName: 'marketOf',
          args: [BigInt(plan.id)],
        }),
        publicClient.readContract({
          address: spec.feeRouter,
          abi: feeAbi,
          functionName: 'marketOf',
          args: [BigInt(plan.id)],
        }),
        publicClient.readContract({ address: market, abi: lmsrAbi, functionName: 'owner' }),
        publicClient.getCode({ address: market }).then(implFromClone),
      ])
      if (boundMint.toLowerCase() !== market.toLowerCase()) {
        throw new Error(`#${plan.id} mint.marketOf mismatch`)
      }
      if (boundFee.toLowerCase() !== market.toLowerCase()) {
        throw new Error(`#${plan.id} feeRouter.marketOf mismatch`)
      }
      if (owner.toLowerCase() !== spec.feeRouter.toLowerCase()) {
        throw new Error(`#${plan.id} owner ${owner} != fee router`)
      }
      if (!cloneImpl || cloneImpl.toLowerCase() !== impl.toLowerCase()) {
        throw new Error(`#${plan.id} clone impl ${cloneImpl} != ${impl}`)
      }
      console.log(`  #${plan.id} market ${market} (was ${plan.oldMarket})`)
      created.push({
        id: String(plan.id),
        market,
        oldMarket: plan.oldMarket,
        condition: plan.condition,
        fundingEth: formatEther(plan.funding),
      })
    }

    results[spec.slug] = { factory, math: math || spec.existingMath, impl, markets: created }
  }

  console.log('\n=== H-01 redeploy complete ===')
  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
