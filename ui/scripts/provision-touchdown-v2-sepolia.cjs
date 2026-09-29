/**
 * Sepolia dress rehearsal: Touchdown v2.
 *
 * Oracle, Juicebox project owner, and LMSR owner are the existing executive
 * Safe 0xE5148e4399e3D849F629E0FECEcf6fC986e96127 (Pablo, Ryan, Miguel, Eiman;
 * threshold 3 of 4). The deployer still owns the registry, so this script
 * registers and opens the prize, then nominates that Safe as registry owner.
 * The Safe must call acceptOwnership() before lock / settle / cancel are its
 * transactions. reportPayouts must be sent by the Safe: the oracle argument
 * below is that Safe, and the CTF uses msg.sender at report time.
 *
 * Does not supersede Sepolia Touchdown #2. This is an additional market.
 *
 *   CONFIRM=sepolia node scripts/provision-touchdown-v2-sepolia.cjs
 *
 * Key: DEPLOYER_PK in ../prediction/.env. Never printed.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const CHAIN_ID = 11155111
const OUT = '/tmp/touchdown-v2-sepolia.json'
const SAFE = '0xE5148e4399e3D849F629E0FECEcf6fC986e96127'
const REGISTRY = '0x7208B0Ba9B1013000b8D30b60A462079300984E2'
const MINT = '0x22E22C4135be93595f341e072321D18e7D4Ee0D0'
const FACTORY = '0x30b449b6c85B64f4FCBB81fBe48A9d35f41d5674'
const CTF = '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8'
const WETH = '0x8cfF28F922AeEe80d3a0663e735681469F7374c6'
const MISSION_CREATOR = '0xa692eEd67c4D2C1C73DC0515240d27cf7d6fF9D1'
const FEE = ethers.BigNumber.from('10000000000000000')
const FUNDING_PER_OUTCOME = ethers.utils.parseEther('0.01')
const ZERO = '0x0000000000000000000000000000000000000000'
const TEAM_IDS = [601, 602, 603, 604, 605, 606, 24]

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
  const raw = (process.env.SEPOLIA_RPC_URL || (match && match[1]) || '').trim().replace(/^["']|["']$/g, '')
  return raw || 'https://ethereum-sepolia-rpc.publicnode.com'
}

function loadRow() {
  if (!fs.existsSync(OUT)) return {}
  return JSON.parse(fs.readFileSync(OUT, 'utf8'))
}

function save(row) {
  fs.writeFileSync(OUT, JSON.stringify(row, null, 2))
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

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl())
  const network = await provider.getNetwork()
  if (network.chainId !== CHAIN_ID) throw new Error(`expected ${CHAIN_ID}, got ${network.chainId}`)
  const wallet = new ethers.Wallet(loadPk(), provider)
  console.log('deployer', wallet.address)

  const safe = new ethers.Contract(
    SAFE,
    [
      'function getOwners() view returns (address[])',
      'function getThreshold() view returns (uint256)',
      'function VERSION() view returns (string)',
    ],
    provider
  )
  const owners = await safe.getOwners()
  const threshold = await safe.getThreshold()
  console.log('safe', SAFE, 'threshold', threshold.toString(), 'version', await safe.VERSION())
  console.log(' owners', owners.join(', '))
  const want = [
    '0x679d87D8640e66778c3419D164998E720D7495f6',
    '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42',
    '0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA',
  ]
  for (const addr of want) {
    if (!owners.some((o) => o.toLowerCase() === addr.toLowerCase())) {
      throw new Error(`safe is missing signer ${addr}`)
    }
  }

  const registry = new ethers.Contract(
    REGISTRY,
    [
      'function owner() view returns (address)',
      'function pendingOwner() view returns (address)',
      'function count() view returns (uint256)',
      'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
      'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
      'function open(uint256 deprizeId)',
      'function bettingOpen(uint256 deprizeId) view returns (bool)',
      'function teamIds(uint256 deprizeId) view returns (uint256[])',
      'function transferOwnership(address newOwner)',
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
      'event MissionCreated(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, address tokenAddress, uint256 fundingGoal)',
    ],
    wallet
  )
  const payhookAbi = [
    'function setDePrizeRegistry(address registry)',
    'function deprizeRegistry() view returns (address)',
    'function owner() view returns (address)',
  ]
  const lmsrAbi = [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
    'function funding() view returns (uint256)',
    'function fee() view returns (uint64)',
    'function stage() view returns (uint8)',
    'function calcMarginalPrice(uint8 outcomeTokenIndex) view returns (uint256)',
  ]

  const regOwner = await registry.owner()
  if (regOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`registry owner ${regOwner} is not the deployer`)
  }

  const row = loadRow()
  row.safe = SAFE
  row.questionId =
    row.questionId ||
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes('deprize:sepolia:touchdown-v2:v1'))
  row.sunset = row.sunset || Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600
  const n = TEAM_IDS.length
  const funding = FUNDING_PER_OUTCOME.mul(n)
  const conditionId = await ctf.getConditionId(SAFE, row.questionId, n)
  row.conditionId = conditionId
  save(row)

  const balance = await provider.getBalance(wallet.address)
  console.log('balance', ethers.utils.formatEther(balance), 'seed', ethers.utils.formatEther(funding))
  console.log('questionId', row.questionId)
  console.log('conditionId', conditionId)
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
      SAFE,
      'https://moondao.com/deprize/touchdown-v2',
      ethers.utils.parseEther('100'),
      row.sunset,
      30 * 24 * 3600,
      true,
      'DePrize Touchdown v2',
      'DTCH2',
      'DePrize Touchdown v2',
    ])
    const created = parseEvent(receipt, creator.interface, 'MissionCreated')
    if (!created) throw new Error('MissionCreated missing')
    row.missionId = created.args.id.toString()
    row.jbProjectId = created.args.projectId.toString()
    row.payHook = await creator.missionIdToPayHook(created.args.id)
    save(row)
    console.log(' mission', row.missionId, 'jb', row.jbProjectId, 'payHook', row.payHook)
  }

  if (!row.payHookLatched) {
    const hook = new ethers.Contract(row.payHook, payhookAbi, wallet)
    const hookOwner = await hook.owner()
    if (hookOwner.toLowerCase() !== SAFE.toLowerCase()) {
      throw new Error(`pay hook owner ${hookOwner} is not the Safe`)
    }
    // The deployer created the mission but the Safe owns the hook. Latch it
    // from the Safe. Until then the hook does not know about this DePrize.
    row.payHookLatched = false
    row.payHookNeedsSafe = true
    save(row)
    console.log(' pay hook is owned by the Safe; latch is a Safe transaction')
  }

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
  if (marketOwner.toLowerCase() === wallet.address.toLowerCase()) {
    await send(market, 'transferOwnership', [SAFE])
  } else if (marketOwner.toLowerCase() !== SAFE.toLowerCase()) {
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
  } else if (bound.toLowerCase() !== row.market.toLowerCase()) {
    throw new Error(`mint bound to ${bound}`)
  }

  const stateOpen = await registry.bettingOpen(row.deprizeId)
  if (!stateOpen) {
    await send(registry, 'open', [row.deprizeId])
  }

  const pending = await registry.pendingOwner()
  if (pending === ZERO) {
    await send(registry, 'transferOwnership', [SAFE])
    row.registryOwnershipNominated = true
    save(row)
    console.log(' registry ownership nominated; Safe must acceptOwnership()')
  } else {
    console.log(' pending registry owner', pending)
  }

  const [open, teams, stage, marketFee, price, ownerNow] = await Promise.all([
    registry.bettingOpen(row.deprizeId),
    registry.teamIds(row.deprizeId),
    market.stage(),
    market.fee(),
    market.calcMarginalPrice(0),
    market.owner(),
  ])
  if (!open) throw new Error('betting is not open')
  if (teams.map((t) => t.toString()).join(',') !== TEAM_IDS.join(',')) throw new Error('roster mismatch')
  if (stage !== 0) throw new Error(`stage ${stage}`)
  if (!marketFee.eq(FEE)) throw new Error(`fee ${marketFee}`)
  if (ownerNow.toLowerCase() !== SAFE.toLowerCase()) throw new Error('market not owned by Safe')
  if (price.isZero()) throw new Error('price is zero')
  row.verified = true
  save(row)
  console.log(' verified', JSON.stringify(row, null, 2))
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
