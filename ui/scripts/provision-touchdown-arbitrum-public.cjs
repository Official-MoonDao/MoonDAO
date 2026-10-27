/**
 * Provision one DePrize race on an existing v2 registry and mint.
 *
 * The trading fee is 2% (2e16), fixed in this script. Later rungs copy
 * `scripts/races/touchdown-public.json`, change the question, roster, seed,
 * sunset, and funding goal, and pass the same registry and mint.
 *
 * The deployer prepares the condition, creates and seeds the market, transfers
 * the market to the owner Safe, and creates the mission. register, setCondition,
 * setMarket, setDePrizeRegistry, and open are printed for that Safe. This
 * script does not open the prize.
 *
 *   node scripts/provision-touchdown-arbitrum-public.cjs scripts/races/touchdown-public.json
 *   CONFIRM=arbitrum node scripts/provision-touchdown-arbitrum-public.cjs scripts/races/<race>.json
 *
 * Key: DEPLOYER_PK in ../../prediction/.env, or DEPLOYER_PK in the environment.
 * Never printed. RPC: ARBITRUM_RPC_URL, else a public Arbitrum endpoint.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const FEE = ethers.BigNumber.from('20000000000000000') // 2e16 = 2%
const ZERO = '0x0000000000000000000000000000000000000000'
const TWO_YEARS = 2 * 365 * 24 * 3600

function loadPk() {
  if (process.env.DEPLOYER_PK) {
    let pk = process.env.DEPLOYER_PK.trim().replace(/^["']|["']$/g, '')
    if (!pk.startsWith('0x')) pk = `0x${pk}`
    return pk
  }
  const envPath = path.resolve(__dirname, '../../prediction/.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^DEPLOYER_PK=(.*)$/m)
  if (!match) throw new Error('DEPLOYER_PK missing')
  let pk = match[1].trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk
}

function rpcUrl() {
  return process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
}

function loadSpec(file) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!spec.question || !Array.isArray(spec.roster) || spec.roster.length < 2) {
    throw new Error('race spec needs question and a roster of at least 2')
  }
  const teamIds = spec.roster.map((row) => {
    if (!row.name || !Number.isInteger(row.teamId))
      throw new Error(`bad roster row ${JSON.stringify(row)}`)
    return row.teamId
  })
  if (new Set(teamIds).size !== teamIds.length) throw new Error('roster team ids must be unique')
  for (const key of ['oracle', 'owner', 'factory', 'ctf', 'weth', 'missionCreator']) {
    if (!ethers.utils.isAddress(spec[key] || ''))
      throw new Error(`race spec ${key} is not an address`)
  }
  return { ...spec, teamIds }
}

function sunsetOf(spec, saved) {
  if (saved) return saved
  if (spec.sunset === '2y' || spec.sunset == null) return Math.floor(Date.now() / 1000) + TWO_YEARS
  const n = Number(spec.sunset)
  if (!Number.isFinite(n) || n < 1_700_000_000)
    throw new Error('sunset must be "2y" or a unix timestamp')
  return n
}

function outPath(spec) {
  const slug = spec.question.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return path.resolve('/tmp', `deprize-race-${slug}.json`)
}

async function send(contract, method, args, opts = {}) {
  const estimateOverrides = {}
  if (opts.valueOverride) estimateOverrides.value = opts.valueOverride
  const gas = await contract.estimateGas[method](...args, estimateOverrides)
  const tx = await contract[method](...args, {
    ...estimateOverrides,
    gasLimit: gas.mul(12).div(10),
  })
  console.log(' tx', method, tx.hash)
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

function printSafeBatch(spec, row) {
  if (!ethers.utils.isAddress(spec.registry || '') || !row.conditionId) {
    console.log(
      '--- Safe batch. Open is last. Calldata is printed once registry, condition, and market exist. ---'
    )
    console.log('1 payHook.setDePrizeRegistry(registry)')
    console.log('2 registry.register(jbProjectId, teamIds, sunset)')
    console.log('3 registry.setCondition(deprizeId, conditionId)')
    console.log('4 mint.setMarket(deprizeId, market)')
    console.log('5 registry.open(deprizeId)')
    return
  }
  const registry = new ethers.utils.Interface([
    'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
    'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
    'function open(uint256 deprizeId)',
  ])
  const mint = new ethers.utils.Interface(['function setMarket(uint256 deprizeId, address market)'])
  const hook = new ethers.utils.Interface(['function setDePrizeRegistry(address registry)'])
  console.log('--- Safe batch. Open is last. Do not send it from this script. ---')
  console.log('owner', spec.owner)
  if (row.payHook) {
    console.log('1', row.payHook, hook.encodeFunctionData('setDePrizeRegistry', [spec.registry]))
  } else {
    console.log('1 payHook.setDePrizeRegistry after createMission returns the hook')
  }
  console.log(
    '2',
    spec.registry,
    registry.encodeFunctionData('register', [row.jbProjectId || '0', spec.teamIds, row.sunset])
  )
  console.log(
    '3',
    spec.registry,
    registry.encodeFunctionData('setCondition', [row.deprizeId || '0', row.conditionId])
  )
  console.log(
    '4',
    spec.mint,
    mint.encodeFunctionData('setMarket', [row.deprizeId || '0', row.market || ZERO])
  )
  console.log('5', spec.registry, registry.encodeFunctionData('open', [row.deprizeId || '0']))
}

async function main() {
  const specFile = process.argv[2]
  if (!specFile) throw new Error('pass a race spec json path')
  const spec = loadSpec(path.resolve(specFile))
  const questionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(spec.question))
  const n = spec.teamIds.length
  const seedEach = ethers.utils.parseEther(String(spec.seedPerNameEth))
  const funding = seedEach.mul(n)
  const goal = ethers.utils.parseEther(String(spec.fundingGoalEth))
  const savedPath = outPath(spec)
  const saved = fs.existsSync(savedPath) ? JSON.parse(fs.readFileSync(savedPath, 'utf8')) : {}
  const sunset = sunsetOf(spec, saved.sunset)

  console.log('race', spec.name || spec.question)
  console.log('question', spec.question)
  console.log('questionId', questionId)
  console.log('roster', spec.roster.map((row) => `${row.teamId} ${row.name}`).join(' | '))
  console.log('fee', FEE.toString(), '(2%)')
  console.log('seed', ethers.utils.formatEther(funding), 'ETH')
  console.log('funding goal (kept by the mission)', ethers.utils.formatEther(goal), 'ETH')
  console.log('sunset', sunset)
  console.log('oracle', spec.oracle)
  console.log('owner', spec.owner)
  console.log('registry', spec.registry || '(required before broadcast)')
  console.log('mint', spec.mint || '(required before broadcast)')

  const row = {
    ...saved,
    question: spec.question,
    questionId,
    sunset,
    fee: FEE.toString(),
    teamIds: spec.teamIds,
    fundingWei: funding.toString(),
    fundingGoalWei: goal.toString(),
  }

  const confirm = process.env.CONFIRM
  if (confirm !== spec.confirm) {
    printSafeBatch(spec, row)
    console.log(`dry run. Set CONFIRM=${spec.confirm} to broadcast the deployer steps.`)
    return
  }

  if (!ethers.utils.isAddress(spec.registry || '') || !ethers.utils.isAddress(spec.mint || '')) {
    throw new Error('registry and mint must already be deployed. This script reuses them.')
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl())
  const network = await provider.getNetwork()
  if (network.chainId !== spec.chainId)
    throw new Error(`expected chain ${spec.chainId}, got ${network.chainId}`)
  const wallet = new ethers.Wallet(loadPk(), provider)
  console.log('deployer', wallet.address)

  const ctf = new ethers.Contract(
    spec.ctf,
    [
      'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount)',
      'function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) view returns (bytes32)',
      'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
    ],
    wallet
  )
  const factory = new ethers.Contract(
    spec.factory,
    [
      'function createLMSRMarketMaker(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
      'event LMSRMarketMakerCreation(address indexed creator, address lmsrMarketMaker, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
    ],
    wallet
  )
  const weth = new ethers.Contract(
    spec.weth,
    [
      'function deposit() payable',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function balanceOf(address) view returns (uint256)',
    ],
    wallet
  )
  const creator = new ethers.Contract(
    spec.missionCreator,
    [
      'function owner() view returns (address)',
      'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
      'function missionIdToPayHook(uint256) view returns (address)',
      'event MissionCreated(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, address tokenAddress, uint256 fundingGoal)',
    ],
    wallet
  )
  const lmsrAbi = [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
    'function fee() view returns (uint64)',
  ]

  const creatorOwner = await creator.owner()
  if (creatorOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`mission creator owner ${creatorOwner} is not the deployer`)
  }

  row.conditionId = await ctf.getConditionId(spec.oracle, questionId, n)
  const balance = await provider.getBalance(wallet.address)
  if (balance.lt(funding.add(ethers.utils.parseEther('0.05')))) {
    throw new Error('deployer balance is short of the seed plus gas')
  }

  const slots = await ctf.getOutcomeSlotCount(row.conditionId)
  if (slots.eq(0)) {
    await send(ctf, 'prepareCondition', [spec.oracle, questionId, n])
  } else if (!slots.eq(n)) {
    throw new Error(`condition has ${slots} slots, expected ${n}`)
  }

  if (!row.jbProjectId) {
    const receipt = await send(creator, 'createMission', [
      spec.teamId,
      spec.owner,
      spec.projectUri,
      goal,
      sunset,
      (spec.refundPeriodDays || 30) * 24 * 3600,
      Boolean(spec.token),
      spec.tokenName,
      spec.tokenSymbol,
      spec.memo || spec.name || spec.question,
    ])
    const created = parseEvent(receipt, creator.interface, 'MissionCreated')
    if (!created) throw new Error('MissionCreated missing')
    row.missionId = created.args.id.toString()
    row.jbProjectId = created.args.projectId.toString()
    row.payHook = await creator.missionIdToPayHook(created.args.id)
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  }

  if (!row.market) {
    const wethBal = await weth.balanceOf(wallet.address)
    if (wethBal.lt(funding)) {
      await send(weth, 'deposit', [], { valueOverride: funding.sub(wethBal) })
    }
    await send(weth, 'approve', [spec.factory, funding])
    const receipt = await send(factory, 'createLMSRMarketMaker', [
      spec.ctf,
      spec.weth,
      [row.conditionId],
      FEE,
      ZERO,
      funding,
    ])
    const created = parseEvent(receipt, factory.interface, 'LMSRMarketMakerCreation')
    if (!created) throw new Error('LMSRMarketMakerCreation missing')
    row.market = created.args.lmsrMarketMaker
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  }

  const market = new ethers.Contract(row.market, lmsrAbi, wallet)
  const marketOwner = await market.owner()
  if (marketOwner.toLowerCase() === wallet.address.toLowerCase()) {
    await send(market, 'transferOwnership', [spec.owner])
  } else if (marketOwner.toLowerCase() !== spec.owner.toLowerCase()) {
    throw new Error(`market owner ${marketOwner}`)
  }
  const fee = await market.fee()
  if (!fee.eq(FEE)) throw new Error(`market fee ${fee.toString()} != ${FEE.toString()}`)

  fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  console.log('saved', savedPath)
  printSafeBatch(spec, row)
  console.log('fee check passed:', fee.toString())
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
