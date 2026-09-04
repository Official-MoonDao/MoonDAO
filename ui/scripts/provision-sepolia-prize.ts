/**
 * Stand up one unbound Sepolia DePrize end to end:
 * Juicebox mission → payhook latch → CTF condition → LMSR → register/open →
 * mint + FeeRouter wiring → market ownership.
 *
 * Default competition is the Sepolia twin of Arbitrum #1
 * ("The Moon Is A Harsh Mistress").
 *
 *   source ../prediction/.env   # DEPLOYER_PK
 *   yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-prize.ts
 */
import { writeFileSync } from 'node:fs'
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  keccak256,
  parseAbi,
  parseEther,
  stringify,
  toBytes,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const REGISTRY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D' as const
const MINT = '0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8' as const
const FEE_ROUTER = '0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a' as const
const FACTORY = '0x8787Dc3c2b48b19D3Cbd25226Cd6cEAff3398de1' as const
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8' as const
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6' as const
const MISSION_CREATOR = '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1' as const
const MANAGED_TEAM_ID = 22n
const FUNDING_PER_OUTCOME = parseEther('0.01')
const FEE = 10_000_000_000_000_000n // 1%
const SUNSET = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
const OUT = '/tmp/sepolia-prize.json'

const PRIZE = {
  slug: 'harsh-mistress',
  title: 'The Moon Is A Harsh Mistress',
  tagline:
    'Which team posts “The Moon is a harsh mistress” first? Back a team — every bet grows the prize pool.',
  metaDescription:
    'Sepolia DePrize: back the MoonDAO team you think will post “The Moon is a harsh mistress” first. Live LMSR odds, and every bet funds the prize pool.',
  teamIds: [2n, 6n, 7n, 8n],
  tokenName: 'DePrize Harsh',
  tokenSymbol: 'DHMS',
}

const registryAbi = parseAbi([
  'function count() view returns (uint256)',
  'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
  'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
  'function open(uint256 deprizeId)',
  'function state(uint256) view returns (uint8)',
  'function bettingOpen(uint256) view returns (bool)',
  'function deprizeIdByJBProject(uint256 jbProjectId) view returns (uint256)',
  'event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset)',
])

const mintAbi = parseAbi([
  'function setMarket(uint256 deprizeId, address market)',
  'function marketOf(uint256 deprizeId) view returns (address)',
])

const feeAbi = parseAbi(['function setMarket(uint256 deprizeId, address market)'])

const ctfAbi = parseAbi([
  'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount)',
  'function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) view returns (bytes32)',
  'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
])

const factoryAbi = parseAbi([
  'function createLMSRWithTWAP(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
  'event LMSRWithTWAPCreation(address indexed creator, address lmsrWithTWAP, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
])

const wethAbi = parseAbi([
  'function deposit()',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
])

const lmsrAbi = parseAbi([
  'function transferOwnership(address newOwner)',
  'function owner() view returns (address)',
  'function stage() view returns (uint8)',
  'function fee() view returns (uint64)',
])

const missionAbi = parseAbi([
  'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
  'function missionIdToProjectId(uint256) view returns (uint256)',
  'function missionIdToPayHook(uint256) view returns (address)',
])

const payhookAbi = parseAbi([
  'function setDePrizeRegistry(address registry)',
  'function deprizeRegistry() view returns (address)',
])

function pk(): Hex {
  const raw = process.env.DEPLOYER_PK || process.env.PRIVATE_KEY
  if (!raw) throw new Error('Set DEPLOYER_PK or PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

function rpcUrl(): string {
  if (process.env.SEPOLIA_RPC_URL) return process.env.SEPOLIA_RPC_URL
  if (process.env.SEPOLIA_RPC) return process.env.SEPOLIA_RPC
  const infura = process.env.NEXT_PUBLIC_INFURA_KEY
  if (infura) return `https://sepolia.infura.io/v3/${infura}`
  return 'https://ethereum-sepolia-rpc.publicnode.com'
}

async function main() {
  const account = privateKeyToAccount(pk())
  const rpc = rpcUrl()
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })

  const send = async (params: Parameters<typeof wallet.writeContract>[0]) => {
    const hash = await wallet.writeContract(params)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`tx reverted ${hash}`)
    return receipt
  }

  const n = BigInt(PRIZE.teamIds.length)
  const funding = FUNDING_PER_OUTCOME * n
  const questionId = keccak256(toBytes(`deprize:sepolia:${PRIZE.slug}:v1`))

  console.log('deployer', account.address)
  console.log('prize', PRIZE.title)
  console.log('questionId', questionId)
  console.log('outcomes', n.toString(), 'funding', funding.toString())

  const before = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'count',
  })
  console.log('registry.count before', before.toString())

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
  const missionArgs = [
    MANAGED_TEAM_ID,
    account.address,
    `https://moondao.com/deprize/${PRIZE.slug}`,
    parseEther('100'),
    deadline,
    30n * 24n * 3600n,
    true,
    PRIZE.tokenName,
    PRIZE.tokenSymbol,
    `DePrize ${PRIZE.title}`,
  ] as const

  const sim = await publicClient.simulateContract({
    account,
    address: MISSION_CREATOR,
    abi: missionAbi,
    functionName: 'createMission',
    args: missionArgs,
  })
  await send({
    address: MISSION_CREATOR,
    abi: missionAbi,
    functionName: 'createMission',
    args: missionArgs,
  })
  const missionId = sim.result
  const jbProjectId = await publicClient.readContract({
    address: MISSION_CREATOR,
    abi: missionAbi,
    functionName: 'missionIdToProjectId',
    args: [missionId],
  })
  if (!jbProjectId) throw new Error('createMission produced no jb project')
  const payHook = await publicClient.readContract({
    address: MISSION_CREATOR,
    abi: missionAbi,
    functionName: 'missionIdToPayHook',
    args: [missionId],
  })
  console.log('  missionId', missionId.toString(), 'jbProjectId', jbProjectId.toString())
  console.log('  payHook', payHook)

  if (payHook && payHook !== '0x0000000000000000000000000000000000000000') {
    const current = await publicClient.readContract({
      address: payHook,
      abi: payhookAbi,
      functionName: 'deprizeRegistry',
    })
    if (current.toLowerCase() !== REGISTRY.toLowerCase()) {
      await send({
        address: payHook,
        abi: payhookAbi,
        functionName: 'setDePrizeRegistry',
        args: [REGISTRY],
      })
    }
  }

  const conditionId = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: 'getConditionId',
    args: [account.address, questionId, n],
  })
  const slots = await publicClient.readContract({
    address: CTF,
    abi: ctfAbi,
    functionName: 'getOutcomeSlotCount',
    args: [conditionId],
  })
  if (slots === 0n) {
    await send({
      address: CTF,
      abi: ctfAbi,
      functionName: 'prepareCondition',
      args: [account.address, questionId, n],
    })
  }
  console.log('  conditionId', conditionId, slots > 0n ? '(pre-existing)' : '')

  const wethBal = await publicClient.readContract({
    address: WETH,
    abi: wethAbi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (wethBal < funding) {
    await send({
      address: WETH,
      abi: wethAbi,
      functionName: 'deposit',
      value: funding - wethBal,
    })
  }
  await send({
    address: WETH,
    abi: wethAbi,
    functionName: 'approve',
    args: [FACTORY, funding],
  })

  const lmsrReceipt = await send({
    address: FACTORY,
    abi: factoryAbi,
    functionName: 'createLMSRWithTWAP',
    args: [CTF, WETH, [conditionId], FEE, '0x0000000000000000000000000000000000000000', funding],
  })
  let market: Hex | undefined
  for (const log of lmsrReceipt.logs) {
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
  if (!market) throw new Error('no LMSRWithTWAPCreation log')
  console.log('  market', market)

  const regReceipt = await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'register',
    args: [jbProjectId, PRIZE.teamIds, SUNSET],
  })
  let deprizeId: bigint | undefined
  for (const log of regReceipt.logs) {
    try {
      const parsed = decodeEventLog({
        abi: registryAbi,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'DePrizeRegistered') {
        deprizeId = (parsed.args as { deprizeId: bigint }).deprizeId
      }
    } catch {
      /* skip */
    }
  }
  if (deprizeId === undefined) {
    deprizeId = await publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'count',
    })
  }
  console.log('  deprizeId', deprizeId.toString())

  await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'setCondition',
    args: [deprizeId, conditionId],
  })
  await send({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'open',
    args: [deprizeId],
  })
  await send({
    address: MINT,
    abi: mintAbi,
    functionName: 'setMarket',
    args: [deprizeId, market],
  })
  await send({
    address: FEE_ROUTER,
    abi: feeAbi,
    functionName: 'setMarket',
    args: [deprizeId, market],
  })
  const owner = await publicClient.readContract({
    address: market,
    abi: lmsrAbi,
    functionName: 'owner',
  })
  if (owner.toLowerCase() === account.address.toLowerCase()) {
    await send({
      address: market,
      abi: lmsrAbi,
      functionName: 'transferOwnership',
      args: [FEE_ROUTER],
    })
  }

  const [state, bettingOpen, mintMarket, lmsrOwner, stage, fee] = await Promise.all([
    publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'state',
      args: [deprizeId],
    }),
    publicClient.readContract({
      address: REGISTRY,
      abi: registryAbi,
      functionName: 'bettingOpen',
      args: [deprizeId],
    }),
    publicClient.readContract({
      address: MINT,
      abi: mintAbi,
      functionName: 'marketOf',
      args: [deprizeId],
    }),
    publicClient.readContract({
      address: market,
      abi: lmsrAbi,
      functionName: 'owner',
    }),
    publicClient.readContract({
      address: market,
      abi: lmsrAbi,
      functionName: 'stage',
    }),
    publicClient.readContract({
      address: market,
      abi: lmsrAbi,
      functionName: 'fee',
    }),
  ])

  const result = {
    slug: PRIZE.slug,
    title: PRIZE.title,
    tagline: PRIZE.tagline,
    metaDescription: PRIZE.metaDescription,
    deprizeId: Number(deprizeId),
    questionId,
    conditionId,
    market,
    jbProjectId: jbProjectId.toString(),
    missionId: missionId.toString(),
    payHook,
    teamIds: PRIZE.teamIds.map(String),
    sunset: SUNSET.toString(),
    state: Number(state),
    bettingOpen,
    mintMarket,
    lmsrOwner,
    stage: Number(stage),
    fee: fee.toString(),
  }
  writeFileSync(OUT, stringify(result, null, 2))

  console.log('\nVerify:')
  console.log('  state OPEN', Number(state) === 2, `(${Number(state)})`)
  console.log('  bettingOpen', bettingOpen)
  console.log('  mint.marketOf', mintMarket)
  console.log('  lmsr.owner FeeRouter', lmsrOwner.toLowerCase() === FEE_ROUTER.toLowerCase())
  console.log('  lmsr.stage Running', Number(stage) === 0)
  console.log('  lmsr.fee 1%', fee === FEE)
  console.log('  recorded', OUT)

  console.log('\nBind this in competitions.ts:\n')
  console.log(`    ${result.deprizeId}: {`)
  console.log(`      title: ${JSON.stringify(PRIZE.title)},`)
  console.log(`      tagline:`)
  console.log(`        ${JSON.stringify(PRIZE.tagline)},`)
  console.log(`      metaDescription:`)
  console.log(`        ${JSON.stringify(PRIZE.metaDescription)},`)
  console.log(`      questionId: '${questionId}',`)
  console.log(`    },`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
