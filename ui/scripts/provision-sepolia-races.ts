/**
 * Stand up remaining Moon Base Zero capability races on Sepolia v2
 * (landing pads, habitat, comms, Night Shift) so `/deprize/{goalId}` can
 * load a live stock-LMSR market. Touchdown is already id 1 on the v2
 * registry — skip it or it will create a second generation. Crewed lander /
 * rover / ISRU / fission on the v1 registry stay there until the UI rebind.
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

function envAddr(name: string, fallback: `0x${string}`): `0x${string}` {
  const raw = process.env[name]
  return (raw && raw.startsWith('0x') ? raw : fallback) as `0x${string}`
}

const REGISTRY = envAddr(
  'DEPRIZE_REGISTRY',
  '0x7208B0Ba9B1013000b8D30b60A462079300984E2'
)
const MINT = envAddr('DEPRIZE_MINT', '0x22E22C4135be93595f341e072321D18e7D4Ee0D0')
const FACTORY = envAddr(
  'DEPRIZE_FACTORY',
  '0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674'
)
const COMPLIANCE_SIGNER = envAddr(
  'DEPRIZE_COMPLIANCE_SIGNER',
  '0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011'
)
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
  // Frozen outcome order. Defaults to the atlas project list. Touchdown keeps
  // the five landers already on v2 id 1; ispace-apex is on the atlas and is
  // not part of this generation.
  projectIds?: string[]
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
    projectIds: [
      'astrobotic-griffin',
      'im-nova-c',
      'firefly-blue-ghost',
      'blue-origin-blue-moon-mk1',
      'cnsa-change-7',
    ],
    tokenName: 'DePrize Touchdown',
    tokenSymbol: 'DTCH',
  },
  {
    goalId: 'shared-night-shift',
    raceLabel: 'Lunar night power',
    teamIds: [611n, 612n, 613n, 614n, 615n, 616n, 617n, FIELD_TEAM],
    tokenName: 'DePrize Night Shift',
    tokenSymbol: 'DNGT',
  },
  {
    // Already registered as v2 id 4. Do not run this row again.
    goalId: 'shared-lunar-rover',
    raceLabel: 'Crewed lunar rover',
    teamIds: [621n, 622n, 623n, FIELD_TEAM],
    tokenName: 'DePrize Rover',
    tokenSymbol: 'DROV',
  },
  {
    // Already registered as v2 id 5. Do not run this row again.
    goalId: 'shared-first-tracks',
    raceLabel: 'First Tracks',
    teamIds: [631n, 632n, 633n, 634n, 635n, FIELD_TEAM],
    tokenName: 'DePrize First Tracks',
    tokenSymbol: 'DTRK',
  },
  {
    // Already registered as v2 id 6. Do not run this row again.
    goalId: 'shared-ice',
    raceLabel: 'Surface water ice',
    teamIds: [641n, 642n, 643n, FIELD_TEAM],
    tokenName: 'DePrize Ice',
    tokenSymbol: 'DICE',
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
  'function setComplianceSigner(address complianceSigner)',
  'function complianceSigner() view returns (address)',
])

const ctfAbi = parseAbi([
  'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount)',
  'function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) view returns (bytes32)',
  'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
])

const factoryAbi = parseAbi([
  'function createLMSRMarketMaker(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
  'event LMSRMarketMakerCreation(address indexed creator, address lmsrMarketMaker, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
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
  projectIds: string[]
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
    const projects = race.projectIds ?? goal.projectIds
    if (projects.length + 1 !== race.teamIds.length) {
      throw new Error(`${race.goalId}: team count must be competitors + field`)
    }
    for (const id of projects) {
      if (!goal.projectIds.includes(id)) {
        throw new Error(`${race.goalId}: ${id} is not on the atlas goal`)
      }
    }

    const n = BigInt(race.teamIds.length)
    const funding = FUNDING_PER_OUTCOME * n
    // v1–v3 of shared-next-landing are already prepared (v1 registry #21/#22
    // and v2 registry #1). Pass QUESTION_VERSION=v4 for a new generation.
    const questionVersion = process.env.QUESTION_VERSION || 'v1'
    const questionId = keccak256(
      toBytes(`deprize:sepolia:${race.goalId}:${questionVersion}`)
    )

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
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `createMission failed for ${race.goalId}: ${message}. Refusing a synthetic Juicebox id.`
      )
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
      functionName: 'createLMSRMarketMaker',
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
        if (parsed.eventName === 'LMSRMarketMakerCreation') {
          market = (parsed.args as { lmsrMarketMaker: Hex }).lmsrMarketMaker
        }
      } catch {
        /* not this event */
      }
    }
    if (!market) throw new Error('no LMSRMarketMakerCreation log')
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
    const signer = await publicClient.readContract({
      address: MINT,
      abi: mintAbi,
      functionName: 'complianceSigner',
    })
    if (signer.toLowerCase() !== COMPLIANCE_SIGNER.toLowerCase()) {
      await send({
        address: MINT,
        abi: mintAbi,
        functionName: 'setComplianceSigner',
        args: [COMPLIANCE_SIGNER],
      })
    }
    const owner = await publicClient.readContract({
      address: market,
      abi: lmsrAbi,
      functionName: 'owner',
    })
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`LMSR owner ${owner} is not the deployer ${account.address}`)
    }

    results.push({
      goalId: race.goalId,
      deprizeId: Number(deprizeId),
      questionId,
      conditionId,
      market,
      jbProjectId: jbProjectId.toString(),
      teamIds: race.teamIds.map(String),
      projectIds: projects,
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
      `      outcomes: [${r.projectIds
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
