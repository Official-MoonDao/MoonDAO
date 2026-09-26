/**
 * Register the four Sepolia capability races on Arbitrum One.
 *
 * Uses the live 0.8 stack (H-01 LMSRWithTWAP factory, FeeRouter, MissionCreator).
 * Does not touch Sepolia. Skips a goal already marked verified in
 * /tmp/arbitrum-capability-races.json. Default seed is 0.008 ETH per outcome.
 * If the deployer cannot cover that plus gas, the not-yet-created market is
 * seeded at 0.003 ETH per outcome instead (Water Ice, 2026-09-25).
 *
 *   CONFIRM=arbitrum node scripts/provision-arbitrum-races.cjs
 *
 * Key: DEPLOYER_PK in ../prediction/.env (or PRIVATE_KEY). Never printed.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const CHAIN_ID = 42161
const RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
const OUT = '/tmp/arbitrum-capability-races.json'

const REGISTRY = '0xf8B2244634c6eCeF32de10BFe0D7436413A59924'
const MINT = '0xfa36cAb21415B4e23a1eecCFe7B07693A690d838'
const FEE_ROUTER = '0x0EF00977e37e2e106BB6E9fa15952bB43a2761e1'
const FACTORY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D'
const EXPECTED_IMPL = '0xF9a3A691dF3568B0822EdA56914C2165087831e5'
const CTF = '0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29'
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
const MISSION_CREATOR = '0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B'

const FIELD_TEAM = 24
const FUNDING_PER_OUTCOME = ethers.utils.parseEther('0.008')
const FEE = ethers.BigNumber.from('10000000000000000') // 1%
const ZERO = '0x0000000000000000000000000000000000000000'

const RACES = [
  {
    goalId: 'shared-next-landing',
    raceLabel: 'Next lunar landing',
    title: 'Touchdown',
    tokenName: 'DePrize Touchdown',
    tokenSymbol: 'DTCH',
    teamIds: [601, 602, 603, 604, 605, FIELD_TEAM],
    projectIds: [
      'astrobotic-griffin',
      'im-nova-c',
      'firefly-blue-ghost',
      'blue-origin-blue-moon-mk1',
      'cnsa-change-7',
    ],
  },
  {
    goalId: 'shared-night-shift',
    raceLabel: 'Lunar night power',
    title: 'Night Shift',
    tokenName: 'DePrize Night Shift',
    tokenSymbol: 'DNGT',
    teamIds: [611, 612, 613, 614, 615, 616, 617, FIELD_TEAM],
    projectIds: [
      'zeno-harmonia',
      'astrobotic-nite',
      'venturi-lunar-battery',
      'perpetual-atomics-endure',
      'cnnc-lunar-rtg',
      'rosatom-lunar-rtg',
      'isro-barc-rhu',
    ],
  },
  {
    goalId: 'shared-first-tracks',
    raceLabel: 'First Tracks',
    title: 'First Tracks',
    tokenName: 'DePrize First Tracks',
    tokenSymbol: 'DTRK',
    teamIds: [631, 632, 633, 634, 635, FIELD_TEAM],
    projectIds: [
      'astrolab-flip',
      'voyager-cuberover',
      'lunar-outpost-mapp',
      'ispace-tenacious',
      'cmu-iris',
    ],
  },
  {
    goalId: 'shared-ice',
    raceLabel: 'Surface water ice',
    title: 'Water Ice',
    tokenName: 'DePrize Ice',
    tokenSymbol: 'DICE',
    teamIds: [641, 642, 643, FIELD_TEAM],
    projectIds: ['cnsa-change-7', 'blue-origin-viper', 'im-4-volatiles'],
  },
]

function loadPk() {
  if (process.env.PRIVATE_KEY) return normalizePk(process.env.PRIVATE_KEY)
  const envPath = path.resolve(__dirname, '../../prediction/.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^DEPLOYER_PK=(.*)$/m)
  if (!match) throw new Error('DEPLOYER_PK missing from prediction/.env')
  return normalizePk(match[1])
}

function normalizePk(raw) {
  let pk = raw.trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk
}

function loadProgress() {
  if (!fs.existsSync(OUT)) return []
  return JSON.parse(fs.readFileSync(OUT, 'utf8'))
}

function saveProgress(rows) {
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2))
}

function questionIdFor(goalId) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`deprize:arbitrum:${goalId}:v1`))
}

async function send(contract, method, args, opts = {}) {
  const estimateOverrides = {}
  if (opts.valueOverride) estimateOverrides.value = opts.valueOverride
  const gas = await contract.estimateGas[method](...args, estimateOverrides)
  const txOverrides = { ...estimateOverrides, gasLimit: gas.mul(12).div(10) }
  const tx = await contract[method](...args, txOverrides)
  console.log('  tx', method, tx.hash)
  const receipt = await tx.wait()
  if (receipt.status !== 1) throw new Error(`${method} reverted ${tx.hash}`)
  return receipt
}

function parseEvent(receipt, iface, name) {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed.name === name) return parsed
    } catch {
      /* not this event */
    }
  }
  return undefined
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC)
  const network = await provider.getNetwork()
  if (network.chainId !== CHAIN_ID) throw new Error(`expected chain ${CHAIN_ID}, got ${network.chainId}`)

  const wallet = new ethers.Wallet(loadPk(), provider)
  console.log('deployer', wallet.address)

  const registry = new ethers.Contract(
    REGISTRY,
    [
      'function owner() view returns (address)',
      'function count() view returns (uint256)',
      'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
      'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
      'function open(uint256 deprizeId)',
      'function bettingOpen(uint256 deprizeId) view returns (bool)',
      'function teamIds(uint256 deprizeId) view returns (uint256[])',
      'function state(uint256 deprizeId) view returns (uint8)',
      'event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset)',
    ],
    wallet
  )
  const mint = new ethers.Contract(
    MINT,
    [
      'function owner() view returns (address)',
      'function setMarket(uint256 deprizeId, address market)',
      'function marketOf(uint256 deprizeId) view returns (address)',
    ],
    wallet
  )
  const fee = new ethers.Contract(
    FEE_ROUTER,
    [
      'function owner() view returns (address)',
      'function setMarket(uint256 deprizeId, address market)',
      'function marketOf(uint256 deprizeId) view returns (address)',
    ],
    wallet
  )
  const factory = new ethers.Contract(
    FACTORY,
    [
      'function implementationMaster() view returns (address)',
      'function createLMSRWithTWAP(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
      'event LMSRWithTWAPCreation(address indexed creator, address lmsrWithTWAP, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
    ],
    wallet
  )
  const ctf = new ethers.Contract(
    CTF,
    [
      'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount)',
      'function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) view returns (bytes32)',
      'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
    ],
    wallet
  )
  const weth = new ethers.Contract(
    WETH,
    [
      'function deposit() payable',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function balanceOf(address) view returns (uint256)',
    ],
    wallet
  )
  const creator = new ethers.Contract(
    MISSION_CREATOR,
    [
      'function owner() view returns (address)',
      'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
      'function missionIdToProjectId(uint256) view returns (uint256)',
      'function missionIdToPayHook(uint256) view returns (address)',
      'event MissionCreated(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, address tokenAddress, uint256 fundingGoal)',
    ],
    wallet
  )
  const lmsrAbi = [
    'function owner() view returns (address)',
    'function funding() view returns (uint256)',
    'function fee() view returns (uint64)',
    'function stage() view returns (uint8)',
    'function atomicOutcomeSlotCount() view returns (uint256)',
    'function conditionIds(uint256) view returns (bytes32)',
    'function transferOwnership(address newOwner)',
    'function calcMarginalPrice(uint8 outcomeTokenIndex) view returns (uint256)',
  ]
  const payhookAbi = [
    'function setDePrizeRegistry(address registry)',
    'function deprizeRegistry() view returns (address)',
    'function owner() view returns (address)',
  ]

  const [regOwner, mintOwner, feeOwner, creatorOwner, impl, count] = await Promise.all([
    registry.owner(),
    mint.owner(),
    fee.owner(),
    creator.owner(),
    factory.implementationMaster(),
    registry.count(),
  ])
  console.log('registry.count', count.toString(), 'impl', impl)
  for (const [label, owner] of [
    ['registry', regOwner],
    ['mint', mintOwner],
    ['feeRouter', feeOwner],
    ['missionCreator', creatorOwner],
  ]) {
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`${label} owner ${owner} is not the deployer`)
    }
  }
  if (impl.toLowerCase() !== EXPECTED_IMPL.toLowerCase()) {
    throw new Error(`factory implementation ${impl} is not the H-01 master`)
  }

  const sunset = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600
  const balance = await provider.getBalance(wallet.address)
  console.log('balance', ethers.utils.formatEther(balance), 'sunset', sunset)

  if (process.env.CONFIRM !== 'arbitrum') {
    console.log('dry run only. Set CONFIRM=arbitrum to broadcast.')
    for (const race of RACES) {
      console.log(race.goalId, questionIdFor(race.goalId), 'outcomes', race.teamIds.length)
    }
    return
  }

  const rows = loadProgress()

  for (const race of RACES) {
    if (race.projectIds.length + 1 !== race.teamIds.length) {
      throw new Error(`${race.goalId}: team count must be competitors plus the open field`)
    }
    let row = rows.find((r) => r.goalId === race.goalId)
    if (row && row.verified) {
      console.log(`\nskip ${race.goalId} (already verified, deprizeId ${row.deprizeId})`)
      continue
    }
    if (!row) {
      row = {
        goalId: race.goalId,
        raceLabel: race.raceLabel,
        title: race.title,
        questionId: questionIdFor(race.goalId),
        teamIds: race.teamIds,
        projectIds: race.projectIds,
        sunset,
      }
      rows.push(row)
      saveProgress(rows)
    }
    console.log(`\n=== ${race.goalId} ===`)
    console.log('questionId', row.questionId)

    const n = race.teamIds.length
    let funding = FUNDING_PER_OUTCOME.mul(n)
    const conditionId = await ctf.getConditionId(wallet.address, row.questionId, n)
    row.conditionId = conditionId
    const existingSlots = await ctf.getOutcomeSlotCount(conditionId)

    if (!row.jbProjectId) {
      if (existingSlots.gt(0)) {
        throw new Error(
          `${race.goalId} condition already exists without a recorded mission. Refusing a second Juicebox project.`
        )
      }
      const deadline = sunset
      const receipt = await send(creator, 'createMission', [
        22,
        wallet.address,
        `https://moondao.com/deprize/${race.goalId}`,
        ethers.utils.parseEther('100'),
        deadline,
        30 * 24 * 3600,
        true,
        race.tokenName,
        race.tokenSymbol,
        `DePrize ${race.raceLabel}`,
      ])
      const created = parseEvent(receipt, creator.interface, 'MissionCreated')
      if (!created) throw new Error('MissionCreated missing')
      row.missionId = created.args.id.toString()
      row.jbProjectId = created.args.projectId.toString()
      row.payHook = await creator.missionIdToPayHook(created.args.id)
      saveProgress(rows)
      console.log('  mission', row.missionId, 'jb', row.jbProjectId, 'payHook', row.payHook)
    }

    if (!row.payHookLatched) {
      const hook = new ethers.Contract(row.payHook, payhookAbi, wallet)
      const current = await hook.deprizeRegistry()
      if (current.toLowerCase() !== REGISTRY.toLowerCase()) {
        const hookOwner = await hook.owner()
        if (hookOwner.toLowerCase() !== wallet.address.toLowerCase()) {
          throw new Error(`payHook owner ${hookOwner} is not the deployer`)
        }
        await send(hook, 'setDePrizeRegistry', [REGISTRY])
      }
      row.payHookLatched = true
      saveProgress(rows)
      console.log('  payHook latched')
    }

    if (existingSlots.eq(0)) {
      await send(ctf, 'prepareCondition', [wallet.address, row.questionId, n])
    }
    const slots = await ctf.getOutcomeSlotCount(conditionId)
    if (!slots.eq(n)) throw new Error(`condition slots ${slots} != ${n}`)
    console.log('  condition', conditionId)

    if (!row.market) {
      // createMission submits a max fee that includes Arbitrum L1 calldata, so the
      // first three races consumed more ETH than the L2 base fee suggested.
      // Shrink only a not-yet-created market so the last race can still open.
      const balNow = await provider.getBalance(wallet.address)
      const reserve = ethers.utils.parseEther('0.0045')
      if (balNow.lt(funding.add(reserve))) {
        const reduced = ethers.utils.parseEther('0.003').mul(n)
        if (balNow.lt(reduced.add(reserve))) {
          throw new Error(
            `${race.goalId} needs ${ethers.utils.formatEther(reduced.add(reserve))} ETH, have ${ethers.utils.formatEther(balNow)}`
          )
        }
        console.log(
          '  seed reduced',
          ethers.utils.formatEther(funding),
          '->',
          ethers.utils.formatEther(reduced)
        )
        funding = reduced
      }
      const wethBal = await weth.balanceOf(wallet.address)
      if (wethBal.lt(funding)) {
        await send(weth, 'deposit', [], { valueOverride: funding.sub(wethBal) })
      }
      await send(weth, 'approve', [FACTORY, funding])
      const receipt = await send(factory, 'createLMSRWithTWAP', [
        CTF,
        WETH,
        [conditionId],
        FEE,
        ZERO,
        funding,
      ])
      const created = parseEvent(receipt, factory.interface, 'LMSRWithTWAPCreation')
      if (!created) throw new Error('LMSRWithTWAPCreation missing')
      row.market = created.args.lmsrWithTWAP
      row.fundingWei = funding.toString()
      saveProgress(rows)
      console.log('  market', row.market)
    }

    if (!row.deprizeId) {
      const receipt = await send(registry, 'register', [row.jbProjectId, race.teamIds, row.sunset])
      const created = parseEvent(receipt, registry.interface, 'DePrizeRegistered')
      if (!created) throw new Error('DePrizeRegistered missing')
      row.deprizeId = created.args.deprizeId.toString()
      saveProgress(rows)
      console.log('  deprizeId', row.deprizeId)
    }

    if (!row.conditionSet) {
      await send(registry, 'setCondition', [row.deprizeId, conditionId])
      row.conditionSet = true
      saveProgress(rows)
    }

    const boundMint = await mint.marketOf(row.deprizeId)
    if (boundMint === ZERO) {
      await send(mint, 'setMarket', [row.deprizeId, row.market])
    } else if (boundMint.toLowerCase() !== row.market.toLowerCase()) {
      throw new Error(`mint already bound to ${boundMint}`)
    }

    const boundFee = await fee.marketOf(row.deprizeId)
    if (boundFee === ZERO) {
      await send(fee, 'setMarket', [row.deprizeId, row.market])
    } else if (boundFee.toLowerCase() !== row.market.toLowerCase()) {
      throw new Error(`fee router already bound to ${boundFee}`)
    }

    const market = new ethers.Contract(row.market, lmsrAbi, wallet)
    const owner = await market.owner()
    if (owner.toLowerCase() === wallet.address.toLowerCase()) {
      await send(market, 'transferOwnership', [FEE_ROUTER])
    } else if (owner.toLowerCase() !== FEE_ROUTER.toLowerCase()) {
      throw new Error(`market owner ${owner} is neither deployer nor fee router`)
    }

    const state = await registry.state(row.deprizeId)
    if (state === 1) {
      await send(registry, 'open', [row.deprizeId])
    }

    const [open, teams, stage, marketFee, marketFunding, price, finalOwner, finalMint, finalFee] =
      await Promise.all([
        registry.bettingOpen(row.deprizeId),
        registry.teamIds(row.deprizeId),
        market.stage(),
        market.fee(),
        market.funding(),
        market.calcMarginalPrice(0),
        market.owner(),
        mint.marketOf(row.deprizeId),
        fee.marketOf(row.deprizeId),
      ])
    if (!open) throw new Error(`${race.goalId} betting is not open`)
    if (teams.map((t) => t.toString()).join(',') !== race.teamIds.join(',')) {
      throw new Error(`${race.goalId} roster mismatch`)
    }
    if (stage !== 0) throw new Error(`${race.goalId} market stage ${stage}`)
    if (!marketFee.eq(FEE)) throw new Error(`${race.goalId} fee ${marketFee}`)
    if (!marketFunding.eq(ethers.BigNumber.from(row.fundingWei))) {
      throw new Error(`${race.goalId} funding ${marketFunding}`)
    }
    if (price.isZero()) throw new Error(`${race.goalId} marginal price is zero`)
    if (finalOwner.toLowerCase() !== FEE_ROUTER.toLowerCase()) throw new Error('owner != fee router')
    if (finalMint.toLowerCase() !== row.market.toLowerCase()) throw new Error('mint market mismatch')
    if (finalFee.toLowerCase() !== row.market.toLowerCase()) throw new Error('fee market mismatch')

    row.verified = true
    saveProgress(rows)
    console.log('  verified betting open, price', price.toString())
  }

  console.log('\n=== recorded ===')
  console.log(JSON.stringify(rows, null, 2))
}

main().catch((err) => {
  console.error(err && err.reason ? err.reason : err && err.message ? err.message : err)
  process.exit(1)
})
