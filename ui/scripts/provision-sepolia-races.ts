/**
 * Stand up the remaining Moon Base Zero capability races on Sepolia
 * (landing pads, habitat, comms) so `/deprize/{goalId}` can load a live
 * market. Crewed lander / rover / ISRU / fission already exist (ids 10, 12,
 * 15, 9).
 *
 *   source ../prediction/.env   # DEPLOYER_PK
 *   yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-races.ts
 *   GOAL_ID=shared-next-landing yarn tsx --tsconfig tsconfig.json scripts/provision-sepolia-races.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
import { OPEN_FIELD_PROJECT_ID } from '../lib/deprize/competitions'
import { SEED_ATLAS } from '../lib/lunar-atlas/seed'
import { sharedGoalById } from '../lib/lunar-atlas/selectors'

const REGISTRY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D' as const
const MINT = '0xa6f9632ee9848f7c1f252da5a1e869ac90e57cc8' as const
const FEE_ROUTER = '0xbe8cbc97d4ddee28b938c0ed8245f1b5133b783a' as const
const FACTORY = '0x8787Dc3c2b48b19D3Cbd25226Cd6cEAff3398de1' as const
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8' as const
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6' as const
const MISSION_CREATOR = '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1' as const
const FIELD_TEAM = 24n
const FUNDING_PER_OUTCOME = parseEther('0.01')
const FEE = 10_000_000_000_000_000n // 1%
const SUNSET = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
const OUT = '/tmp/sepolia-races.json'

const RACES: {
  goalId: string
  raceLabel: string
  teamIds: bigint[]
  tokenName: string
  tokenSymbol: string
}[] = [
  {
    goalId: 'shared-landing-pads',
    raceLabel: 'Landing pads',
    teamIds: [501n, 502n, 503n, 504n, 505n, FIELD_TEAM],
    tokenName: 'DePrize Pads',
    tokenSymbol: 'DPAD',
  },
  {
    goalId: 'shared-habitat',
    raceLabel: 'Pressurized habitat',
    teamIds: [511n, 512n, 513n, 514n, 515n, FIELD_TEAM],
    tokenName: 'DePrize Habitat',
    tokenSymbol: 'DHAB',
  },
  {
    goalId: 'shared-lunar-comms',
    raceLabel: 'Lunar comms',
    teamIds: [521n, 522n, 523n, 524n, 525n, FIELD_TEAM],
    tokenName: 'DePrize Comms',
    tokenSymbol: 'DCOM',
  },
  {
    goalId: 'shared-next-landing',
    raceLabel: 'Next lunar landing',
    teamIds: [601n, 602n, 603n, 604n, 605n, FIELD_TEAM],
    tokenName: 'DePrize Touchdown',
    tokenSymbol: 'DTCH',
  },
]

const registryAbi = parseAbi([
  'function count() view returns (uint256)',
  'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
  'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
  'function open(uint256 deprizeId)',
  'function deprizeIdByJBProject(uint256 jbProjectId) view returns (uint256)',
  'event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset)',
])

const mintAbi = parseAbi([
  'function setMarket(uint256 deprizeId, address market)',
  'function marketOf(uint256 deprizeId) view returns (address)',
])

const feeAbi = parseAbi([
  'function setMarket(uint256 deprizeId, address market)',
])

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

type Result = {
  goalId: string
  deprizeId: number
  questionId: Hex
  conditionId: Hex
  market: Hex
  jbProjectId: string
  teamIds: string[]
}

function loadDone(): Result[] {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')) as Result[]
  } catch {
    return []
  }
}

function pk(): Hex {
  const raw = process.env.DEPLOYER_PK || process.env.PRIVATE_KEY
  if (!raw) throw new Error('Set DEPLOYER_PK or PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

async function main() {
  const account = privateKeyToAccount(pk())
  const rpc =
    process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc, { timeout: 60_000 }),
  })

  console.log('deployer', account.address)
  const count = await publicClient.readContract({
    address: REGISTRY,
    abi: registryAbi,
    functionName: 'count',
  })
  console.log('registry.count', count.toString())

  const done = loadDone()
  const results = [...done]

  const fees = await publicClient.estimateFeesPerGas()
  const maxFeePerGas = ((fees.maxFeePerGas ?? 2_000_000_000n) * 3n) / 2n
  const maxPriorityFeePerGas = (fees.maxPriorityFeePerGas ?? 1_000_000_000n) * 2n

  const send = async (params: Parameters<typeof wallet.writeContract>[0]) => {
    const hash = await wallet.writeContract({
      ...params,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 180_000,
    })
    if (receipt.status !== 'success') throw new Error(`tx reverted ${hash}`)
    return receipt
  }

  const only = process.env.GOAL_ID || process.argv.find((a) => a.startsWith('shared-'))

  for (const race of RACES) {
    if (only && race.goalId !== only) {
      continue
    }
    if (results.some((r) => r.goalId === race.goalId)) {
      console.log(`skip ${race.goalId} (already provisioned)`)
      continue
    }
    const goal = sharedGoalById(SEED_ATLAS, race.goalId)
    if (!goal) throw new Error(`missing goal ${race.goalId}`)
    if (goal.projectIds.length + 1 !== race.teamIds.length) {
      throw new Error(`${race.goalId}: team count must be competitors + field`)
    }

    const n = BigInt(race.teamIds.length)
    const funding = FUNDING_PER_OUTCOME * n
    const questionId = keccak256(toBytes(`deprize:sepolia:${race.goalId}:v1`))

    console.log(`\n=== ${race.goalId} ===`)
    console.log('questionId', questionId)
    console.log('outcomes', n.toString(), 'funding', funding.toString())

    let jbProjectId: bigint
    try {
      if (process.env.SKIP_MISSION) throw new Error('SKIP_MISSION')
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600)
      const missionArgs = [
        22n,
        account.address,
        `https://moondao.com/deprize/${race.goalId}`,
        parseEther('100'),
        deadline,
        30n * 24n * 3600n,
        true,
        race.tokenName,
        race.tokenSymbol,
        `DePrize ${race.raceLabel}`,
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
      jbProjectId = await publicClient.readContract({
        address: MISSION_CREATOR,
        abi: missionAbi,
        functionName: 'missionIdToProjectId',
        args: [sim.result],
      })
      if (!jbProjectId) throw new Error('createMission produced no jb project')
      console.log('  missionId', sim.result.toString(), 'jbProjectId', jbProjectId.toString())
      const payHook = await publicClient.readContract({
        address: MISSION_CREATOR,
        abi: missionAbi,
        functionName: 'missionIdToPayHook',
        args: [sim.result],
      })
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
        console.log('  payHook', payHook)
      }
    } catch (err) {
      console.warn('  createMission failed, using synthetic jb id:', err)
      jbProjectId = 0n
    }
    if (!jbProjectId) {
      // register() only needs a unique unused jbProjectId; viewing the market
      // does not require a live Juicebox project.
      let candidate = 3000n + BigInt(results.length)
      for (;;) {
        const bound = await publicClient.readContract({
          address: REGISTRY,
          abi: registryAbi,
          functionName: 'deprizeIdByJBProject',
          args: [candidate],
        })
        if (bound === 0n) break
        candidate++
      }
      jbProjectId = candidate
      console.log('  synthetic jbProjectId', jbProjectId.toString())
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
      args: [jbProjectId, race.teamIds, SUNSET],
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
      const next = await publicClient.readContract({
        address: REGISTRY,
        abi: registryAbi,
        functionName: 'count',
      })
      deprizeId = next
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

    results.push({
      goalId: race.goalId,
      deprizeId: Number(deprizeId),
      questionId,
      conditionId,
      market,
      jbProjectId: jbProjectId.toString(),
      teamIds: race.teamIds.map(String),
    })
    writeFileSync(OUT, stringify(results, null, 2))
    console.log('  recorded', OUT)
  }

  console.log('\nBind these in competitions.ts:\n')
  for (const r of results) {
    const goal = sharedGoalById(SEED_ATLAS, r.goalId)!
    const named = r.teamIds.slice(0, -1)
    console.log(`    ${r.deprizeId}: {`)
    console.log(`      title: ${JSON.stringify(goal.title)},`)
    console.log(`      sharedGoalId: '${r.goalId}',`)
    console.log(`      questionId: '${r.questionId}',`)
    console.log(
      `      outcomes: [${goal.projectIds
        .map((id, i) => `{ projectId: '${id}', teamId: ${named[i]} }`)
        .join(', ')}, { projectId: '${OPEN_FIELD_PROJECT_ID}', teamId: 24, field: true }],`,
    )
    console.log(`    },`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
