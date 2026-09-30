/**
 * Sepolia failure prize for the dress rehearsal.
 *
 * Two outcomes (team ids 701 and 702). Oracle and LMSR owner are the executive
 * Safe. The deployer registers and opens the prize while it still owns the
 * registry. The pay hook is latched here, then the hook and the Juicebox
 * project NFT are transferred to the Safe. createMission has to name the
 * deployer as `to` for that latch; the locked 90% payout split therefore
 * names the deployer. Surplus payments use project ownership, which ends on
 * the Safe.
 *
 * Does not touch DePrize #7 and does not call transferOwnership on the registry.
 *
 *   CONFIRM=sepolia node scripts/provision-failure-rehearsal-sepolia.cjs
 *
 * Key: DEPLOYER_PK in ../prediction/.env. Never printed.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const CHAIN_ID = 11155111
const OUT = '/tmp/failure-rehearsal-sepolia.json'
const SAFE = '0xE5148e4399e3D849F629E0FECEcf6fC986e96127'
const REGISTRY = '0x7208B0Ba9B1013000b8D30b60A462079300984E2'
const MINT = '0x22E22C4135be93595f341e072321D18e7D4Ee0D0'
const FACTORY = '0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674'
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8'
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6'
const MISSION_CREATOR = '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1'
const PROJECTS = '0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4'
const TERMINAL = '0x2dB6d704058E552DeFE415753465df8dF0361846'
const TERMINAL_STORE = '0xfE33B439Ec53748C87DcEDACb83f05aDd5014744'
const NATIVE = '0x000000000000000000000000000000000000EEEe'
const TREASURY = '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b'
const TOUCHDOWN_POOL = '0x9cc4EBaA13C274F3bD727fB09C7876606c3Ea23c'
const TOUCHDOWN_MARKET = '0x7deDb1Ac0f53b0208F72977f941186F6FB2394E9'
const FEE = ethers.BigNumber.from('10000000000000000')
const FUNDING_PER_OUTCOME = ethers.utils.parseEther('0.01')
const ZERO = '0x0000000000000000000000000000000000000000'
const TEAM_IDS = [701, 702]
const QUESTION = 'deprize:sepolia:failure-rehearsal:v1'
const WALLETS = {
  pablo: '0x679d87D8640e66778c3419D164998E720D7495f6',
  ryan: '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42',
  miguel: '0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA',
  deployer: null,
}

function loadPk() {
  const envPath = path.resolve(__dirname, '../../prediction/.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^DEPLOYER_PK=(.*)$/m)
  if (!match) throw new Error('DEPLOYER_PK missing')
  let pk = match[1].trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk
}

function rpcUrl() {
  const envPath = path.resolve(__dirname, '../../prediction/.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^SEPOLIA_RPC=(.*)$/m)
  const raw = (process.env.SEPOLIA_RPC_URL || (match && match[1]) || '')
    .trim()
    .replace(/^["']|["']$/g, '')
  return raw || 'https://ethereum-sepolia-rpc.publicnode.com'
}

function loadRow() {
  if (!fs.existsSync(OUT)) return {}
  return JSON.parse(fs.readFileSync(OUT, 'utf8'))
}

function save(row) {
  fs.writeFileSync(OUT, JSON.stringify(row, null, 2))
}

function same(a, b) {
  return a.toLowerCase() === b.toLowerCase()
}

async function send(contract, method, args, opts = {}) {
  const estimateOverrides = {}
  if (opts.valueOverride) estimateOverrides.value = opts.valueOverride
  const gas = await contract.estimateGas[method](...args, estimateOverrides)
  const tx = await contract[method](...args, {
    ...estimateOverrides,
    gasLimit: gas.mul(13).div(10),
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

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl())
  const network = await provider.getNetwork()
  if (network.chainId !== CHAIN_ID) throw new Error(`expected ${CHAIN_ID}, got ${network.chainId}`)
  const wallet = new ethers.Wallet(loadPk(), provider)
  WALLETS.deployer = wallet.address
  console.log('deployer', wallet.address)

  const registry = new ethers.Contract(
    REGISTRY,
    [
      'function owner() view returns (address)',
      'function pendingOwner() view returns (address)',
      'function count() view returns (uint256)',
      'function state(uint256) view returns (uint8)',
      'function bettingOpen(uint256) view returns (bool)',
      'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
      'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
      'function open(uint256 deprizeId)',
      'function teamIds(uint256 deprizeId) view returns (uint256[])',
      'event DePrizeRegistered(uint256 indexed deprizeId, uint256 indexed jbProjectId, uint256[] teamIds, uint256 sunset)',
    ],
    wallet
  )
  const mint = new ethers.Contract(
    MINT,
    [
      'function setMarket(uint256 deprizeId, address market)',
      'function marketOf(uint256 deprizeId) view returns (address)',
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
  const factory = new ethers.Contract(
    FACTORY,
    [
      'function createLMSRMarketMaker(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
      'event LMSRMarketMakerCreation(address indexed creator, address lmsrMarketMaker, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
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
      'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
      'function missionIdToPayHook(uint256) view returns (address)',
      'function missionIdToPoolDeployer(uint256) view returns (address)',
      'event MissionCreated(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, address tokenAddress, uint256 fundingGoal)',
    ],
    wallet
  )
  const projects = new ethers.Contract(
    PROJECTS,
    [
      'function ownerOf(uint256) view returns (address)',
      'function safeTransferFrom(address from, address to, uint256 tokenId)',
    ],
    wallet
  )
  const store = new ethers.Contract(
    TERMINAL_STORE,
    ['function balanceOf(address terminal, uint256 projectId, address token) view returns (uint256)'],
    provider
  )
  const payhookAbi = [
    'function setDePrizeRegistry(address registry)',
    'function deprizeRegistry() view returns (address)',
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
  ]
  const lmsrAbi = [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
    'function funding() view returns (uint256)',
    'function fee() view returns (uint64)',
    'function stage() view returns (uint8)',
    'function calcMarginalPrice(uint8 outcomeTokenIndex) view returns (uint256)',
  ]

  const [regOwner, pending, count, touchdownOwner] = await Promise.all([
    registry.owner(),
    registry.pendingOwner(),
    registry.count(),
    projects.ownerOf(275),
  ])
  if (!same(regOwner, wallet.address)) {
    throw new Error(`registry owner ${regOwner} is not the deployer`)
  }
  if (!same(pending, SAFE)) {
    throw new Error(`pending registry owner ${pending} is not the Safe`)
  }
  if (!same(touchdownOwner, SAFE)) {
    throw new Error(`project 275 owner ${touchdownOwner} is not the Safe`)
  }
  console.log('registry count', count.toString(), 'pending owner is the Safe')

  const row = loadRow()
  row.safe = SAFE
  row.questionText = QUESTION
  row.questionId = row.questionId || ethers.utils.keccak256(ethers.utils.toUtf8Bytes(QUESTION))
  row.sunset = row.sunset || Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600
  const n = TEAM_IDS.length
  const funding = FUNDING_PER_OUTCOME.mul(n)
  const conditionId = await ctf.getConditionId(SAFE, row.questionId, n)
  row.conditionId = conditionId
  row.teamIds = TEAM_IDS
  save(row)

  const balance = await provider.getBalance(wallet.address)
  console.log('balance', ethers.utils.formatEther(balance), 'seed', ethers.utils.formatEther(funding))
  console.log('questionId', row.questionId)
  console.log('conditionId', conditionId)
  console.log('sunset', row.sunset)
  if (balance.lt(funding.add(ethers.utils.parseEther('0.05')))) {
    throw new Error('deployer balance is short of the seed plus gas')
  }
  if (process.env.CONFIRM !== 'sepolia') {
    console.log('dry run. Set CONFIRM=sepolia to broadcast.')
    return
  }

  const slots = await ctf.getOutcomeSlotCount(conditionId)
  if (slots.eq(0)) {
    await send(ctf, 'prepareCondition', [SAFE, row.questionId, n])
  } else if (!slots.eq(n)) {
    throw new Error(`condition has ${slots} slots, expected ${n}`)
  }
  console.log(' condition ready')

  if (!row.jbProjectId) {
    const receipt = await send(creator, 'createMission', [
      22,
      wallet.address,
      'https://moondao.com/deprize/failure-rehearsal',
      ethers.utils.parseEther('100'),
      row.sunset,
      30 * 24 * 3600,
      true,
      'DePrize Failure Rehearsal',
      'DFR',
      'DePrize failure rehearsal',
    ])
    const created = parseEvent(receipt, creator.interface, 'MissionCreated')
    if (!created) throw new Error('MissionCreated missing')
    row.missionId = created.args.id.toString()
    row.jbProjectId = created.args.projectId.toString()
    row.payHook = await creator.missionIdToPayHook(created.args.id)
    row.poolDeployer = await creator.missionIdToPoolDeployer(created.args.id)
    row.splitBeneficiary = wallet.address
    save(row)
    console.log(
      ' mission',
      row.missionId,
      'jb',
      row.jbProjectId,
      'payHook',
      row.payHook,
      'pool',
      row.poolDeployer
    )
  }

  const hook = new ethers.Contract(row.payHook, payhookAbi, wallet)
  const latched = await hook.deprizeRegistry()
  if (latched === ZERO) {
    const hookOwner = await hook.owner()
    if (!same(hookOwner, wallet.address)) {
      throw new Error(`pay hook owner ${hookOwner} cannot latch`)
    }
    await send(hook, 'setDePrizeRegistry', [REGISTRY])
  }
  const latchedNow = await hook.deprizeRegistry()
  if (!same(latchedNow, REGISTRY)) throw new Error(`hook registry ${latchedNow}`)
  row.payHookLatched = true
  save(row)
  console.log(' pay hook latched')

  const hookOwner = await hook.owner()
  if (same(hookOwner, wallet.address)) {
    await send(hook, 'transferOwnership', [SAFE])
  } else if (!same(hookOwner, SAFE)) {
    throw new Error(`pay hook owner ${hookOwner}`)
  }
  console.log(' pay hook owner', SAFE)

  const projectOwner = await projects.ownerOf(row.jbProjectId)
  if (same(projectOwner, wallet.address)) {
    await send(projects, 'safeTransferFrom', [wallet.address, SAFE, row.jbProjectId])
  } else if (!same(projectOwner, SAFE)) {
    throw new Error(`project owner ${projectOwner}`)
  }
  console.log(' project owner', SAFE)

  if (!row.market) {
    const wethBal = await weth.balanceOf(wallet.address)
    if (wethBal.lt(funding)) {
      await send(weth, 'deposit', [], { valueOverride: funding.sub(wethBal) })
    }
    await send(weth, 'approve', [FACTORY, funding])
    const receipt = await send(factory, 'createLMSRMarketMaker', [
      CTF,
      WETH,
      [conditionId],
      FEE,
      ZERO,
      funding,
    ])
    const created = parseEvent(receipt, factory.interface, 'LMSRMarketMakerCreation')
    if (!created) throw new Error('LMSRMarketMakerCreation missing')
    row.market = created.args.lmsrMarketMaker
    row.fundingWei = funding.toString()
    save(row)
    console.log(' market', row.market)
  }

  const market = new ethers.Contract(row.market, lmsrAbi, wallet)
  const marketOwner = await market.owner()
  if (same(marketOwner, wallet.address)) {
    await send(market, 'transferOwnership', [SAFE])
  } else if (!same(marketOwner, SAFE)) {
    throw new Error(`market owner ${marketOwner}`)
  }
  console.log(' market owner', SAFE)

  if (!row.deprizeId) {
    const receipt = await send(registry, 'register', [row.jbProjectId, TEAM_IDS, row.sunset])
    const created = parseEvent(receipt, registry.interface, 'DePrizeRegistered')
    if (!created) throw new Error('DePrizeRegistered missing')
    row.deprizeId = created.args.deprizeId.toString()
    save(row)
    console.log(' deprizeId', row.deprizeId)
  }

  if (!row.conditionSet) {
    await send(registry, 'setCondition', [row.deprizeId, conditionId])
    row.conditionSet = true
    save(row)
  }

  const bound = await mint.marketOf(row.deprizeId)
  if (bound === ZERO) {
    await send(mint, 'setMarket', [row.deprizeId, row.market])
  } else if (!same(bound, row.market)) {
    throw new Error(`mint bound to ${bound}`)
  }

  const stateOpen = await registry.bettingOpen(row.deprizeId)
  if (!stateOpen) {
    await send(registry, 'open', [row.deprizeId])
  }

  const pendingAfter = await registry.pendingOwner()
  const ownerAfter = await registry.owner()
  if (!same(ownerAfter, wallet.address)) throw new Error('registry owner changed')
  if (!same(pendingAfter, SAFE)) throw new Error('pending registry owner changed')

  const [open, teams, stage, marketFee, price, ownerNow, hookNow, projectNow] = await Promise.all([
    registry.bettingOpen(row.deprizeId),
    registry.teamIds(row.deprizeId),
    market.stage(),
    market.fee(),
    market.calcMarginalPrice(0),
    market.owner(),
    hook.owner(),
    projects.ownerOf(row.jbProjectId),
  ])
  if (!open) throw new Error('betting is not open')
  if (teams.map((t) => t.toString()).join(',') !== TEAM_IDS.join(',')) throw new Error('roster mismatch')
  if (stage !== 0) throw new Error(`stage ${stage}`)
  if (!marketFee.eq(FEE)) throw new Error(`fee ${marketFee}`)
  if (!same(ownerNow, SAFE)) throw new Error('market not owned by Safe')
  if (!same(hookNow, SAFE)) throw new Error('hook not owned by Safe')
  if (!same(projectNow, SAFE)) throw new Error('project not owned by Safe')
  if (price.isZero()) throw new Error('price is zero')

  const state7 = await registry.state(7)
  const betting7 = await registry.bettingOpen(7)
  if (state7 !== 2 || !betting7) throw new Error(`prize 7 moved: state ${state7} betting ${betting7}`)

  row.verified = true
  save(row)

  const ethOf = async (addr) => ethers.utils.formatEther(await provider.getBalance(addr))
  const projectEth = async (id) =>
    ethers.utils.formatEther(await store.balanceOf(TERMINAL, id, NATIVE))
  const snapshot = {
    pabloEth: await ethOf(WALLETS.pablo),
    ryanEth: await ethOf(WALLETS.ryan),
    miguelEth: await ethOf(WALLETS.miguel),
    deployerEth: await ethOf(wallet.address),
    treasuryEth: await ethOf(TREASURY),
    touchdownPoolEth: await ethOf(TOUCHDOWN_POOL),
    failurePoolEth: row.poolDeployer ? await ethOf(row.poolDeployer) : null,
    project275Eth: await projectEth(275),
    failureProjectEth: await projectEth(row.jbProjectId),
    touchdownMarketWeth: ethers.utils.formatEther(await weth.balanceOf(TOUCHDOWN_MARKET)),
    failureMarketWeth: ethers.utils.formatEther(await weth.balanceOf(row.market)),
  }
  row.snapshot = snapshot
  save(row)
  console.log(' verified', JSON.stringify(row, null, 2))
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
