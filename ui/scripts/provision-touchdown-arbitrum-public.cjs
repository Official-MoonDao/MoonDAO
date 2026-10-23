/**
 * Public Arbitrum Touchdown. Follows docs/plans/touchdown-arbitrum-public.md.
 *
 * The deployer sends steps 1–4 only: immutable registry, mint, and redeem
 * owned by the executive branch; the condition with the treasury as oracle;
 * the H-01 market seeded at 0.008 ETH per name and transferred to the
 * executive branch; and the Juicebox mission whose project and pay hook
 * start in that Safe.
 *
 * Register, latch, setMarket, the compliance signer, and open are a Safe
 * batch. This script prints that batch. It does not sign it.
 *
 *   node scripts/provision-touchdown-arbitrum-public.cjs
 *   CONFIRM=arbitrum node scripts/provision-touchdown-arbitrum-public.cjs
 *
 * Key: DEPLOYER_PK in ../prediction/.env. Never printed.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const CHAIN_ID = 42161
const RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
const OUT = '/tmp/touchdown-arbitrum-public.json'

const EXECUTIVE = '0xdFc31084ad3887076913e5d0759a27C65A3C5291'
const TREASURY = '0xAF26a002d716508b7e375f1f620338442F5470c0'
const FACTORY = '0x299F163705AbBFa1A8DE7670F33171730F828F3D'
const EXPECTED_IMPL = '0xF9a3A691dF3568B0822EdA56914C2165087831e5'
const CTF = '0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29'
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
const MISSION_CREATOR = '0x87307f5D73c93B5b0a2e250194d62CD2D4BfEe3B'
const JB_TERMINAL = '0x2dB6d704058E552DeFE415753465df8dF0361846'
const QUESTION_ID = '0xd81ff517bc437933758e3679c1107fca6983ca98f2798926af562ab5bdf4b32e'
const QUESTION_PREIMAGE = 'deprize:arbitrum:touchdown-public:v1'

const TEAM_IDS = [601, 602, 603, 604, 605, 606, 24]
const FUNDING_PER_OUTCOME = ethers.utils.parseEther('0.008')
const FEE = ethers.BigNumber.from('10000000000000000')
const ZERO = '0x0000000000000000000000000000000000000000'
const FALLBACK_HANDLER_SLOT =
  '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5'

const EXECUTIVE_SIGNERS = [
  '0x679d87D8640e66778c3419D164998E720D7495f6',
  '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42',
  '0xAF6f2A7643A97b849bD9cf6d3f57e142c5BbB0DA',
  '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801',
  '0xb00E7F2C408D23337dFEe6be44EA2D7AAd4B0FE7',
]
const TREASURY_SIGNERS = [
  '0x679d87D8640e66778c3419D164998E720D7495f6',
  '0xB2d3900807094D4Fe47405871B0C8AdB58E10D42',
  '0xe2d3aC725E6FFE2b28a9ED83bedAaf6672f2C801',
  '0x823b92d6a4b2AED4b15675c7917c9f922ea8ADAD',
  '0x6bFd9e435cF6194c967094959626ddFF4473a836',
  '0xb00E7F2C408D23337dFEe6be44EA2D7AAd4B0FE7',
  '0x5640Ddc028f2436B5C0BA0305D2199556C1b5a95',
]

const ARTIFACTS = path.resolve(__dirname, '../../subscription-contracts/out')

function loadPk() {
  const envPath = path.resolve(__dirname, '../../prediction/.env')
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^DEPLOYER_PK=(.*)$/m)
  if (!match) throw new Error('DEPLOYER_PK missing from prediction/.env')
  let pk = match[1].trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk
}

function complianceSigner() {
  const envPath = path.resolve(__dirname, '../.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('ui/.env.local is missing DEPRIZE_COMPLIANCE_SIGNER_KEY')
  }
  const text = fs.readFileSync(envPath, 'utf8')
  const match = text.match(/^DEPRIZE_COMPLIANCE_SIGNER_KEY=(.*)$/m)
  if (!match) throw new Error('DEPRIZE_COMPLIANCE_SIGNER_KEY missing')
  let pk = match[1].trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return new ethers.Wallet(pk).address
}

function loadRow() {
  if (!fs.existsSync(OUT)) return {}
  return JSON.parse(fs.readFileSync(OUT, 'utf8'))
}

function save(row) {
  fs.writeFileSync(OUT, JSON.stringify(row, null, 2))
}

function artifact(rel) {
  const json = JSON.parse(fs.readFileSync(path.join(ARTIFACTS, rel), 'utf8'))
  const bytecode = json.bytecode && json.bytecode.object
  if (!bytecode || bytecode === '0x') throw new Error(`no bytecode in ${rel}`)
  if (bytecode.includes('__$' )) throw new Error(`${rel} has unlinked libraries`)
  return { abi: json.abi, bytecode }
}

function same(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase()
}

function requireSigners(label, owners, want) {
  for (const addr of want) {
    if (!owners.some((o) => same(o, addr))) {
      throw new Error(`${label} is missing signer ${addr}`)
    }
  }
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

async function deploy(wallet, name, abi, bytecode, args, row, key) {
  if (row[key]) {
    console.log(name, row[key], '(already deployed)')
    return row[key]
  }
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const tx = await factory.getDeployTransaction(...args)
  const gas = await wallet.estimateGas(tx)
  const sent = await wallet.sendTransaction({ ...tx, gasLimit: gas.mul(12).div(10) })
  row[`${key}Tx`] = sent.hash
  save(row)
  console.log(' tx', name, sent.hash)
  const receipt = await sent.wait()
  if (receipt.status !== 1) throw new Error(`${name} deploy reverted ${sent.hash}`)
  const address = receipt.contractAddress
  if (!address) throw new Error(`${name} receipt has no contract address`)
  row[key] = ethers.utils.getAddress(address)
  row[`${key}Block`] = receipt.blockNumber
  save(row)
  console.log(name, row[key], 'block', receipt.blockNumber)
  return row[key]
}

function safeTx(to, data, value = '0') {
  return { to, value, data }
}

async function main() {
  const questionId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(QUESTION_PREIMAGE))
  if (!same(questionId, QUESTION_ID)) {
    throw new Error(`question id ${questionId} does not match the plan`)
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC)
  const network = await provider.getNetwork()
  if (network.chainId !== CHAIN_ID) throw new Error(`expected ${CHAIN_ID}, got ${network.chainId}`)

  const wallet = new ethers.Wallet(loadPk(), provider)
  const expectedDeployer = '0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011'
  if (!same(wallet.address, expectedDeployer)) {
    throw new Error(`deployer ${wallet.address} is not ${expectedDeployer}`)
  }
  const signer = complianceSigner()
  console.log('deployer', wallet.address)
  console.log('compliance signer', signer)
  console.log('questionId', questionId)

  const safeAbi = [
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function VERSION() view returns (string)',
  ]
  const executive = new ethers.Contract(EXECUTIVE, safeAbi, provider)
  const treasury = new ethers.Contract(TREASURY, safeAbi, provider)
  const [execOwners, execThreshold, execVersion, treasOwners, treasThreshold] = await Promise.all([
    executive.getOwners(),
    executive.getThreshold(),
    executive.VERSION(),
    treasury.getOwners(),
    treasury.getThreshold(),
  ])
  console.log('executive', EXECUTIVE, execVersion, 'threshold', execThreshold.toString())
  console.log('treasury threshold', treasThreshold.toString())
  if (!execThreshold.eq(4) || execOwners.length !== 5) {
    throw new Error(`executive threshold ${execThreshold} of ${execOwners.length}, expected 4 of 5`)
  }
  if (!treasThreshold.eq(5) || treasOwners.length !== 7) {
    throw new Error(`treasury threshold ${treasThreshold} of ${treasOwners.length}, expected 5 of 7`)
  }
  requireSigners('executive', execOwners, EXECUTIVE_SIGNERS)
  requireSigners('treasury', treasOwners, TREASURY_SIGNERS)

  const execHandlerWord = await provider.getStorageAt(EXECUTIVE, FALLBACK_HANDLER_SLOT)
  const treasHandlerWord = await provider.getStorageAt(TREASURY, FALLBACK_HANDLER_SLOT)
  const execHandler = ethers.utils.getAddress(ethers.utils.hexDataSlice(execHandlerWord, 12))
  const treasHandler = ethers.utils.getAddress(ethers.utils.hexDataSlice(treasHandlerWord, 12))
  console.log('executive fallback', execHandler)
  console.log('treasury fallback', treasHandler)
  if (execHandler === ZERO || treasHandler === ZERO) {
    throw new Error('a Safe has no fallback handler, so it cannot receive the market inventory')
  }

  const factory = new ethers.Contract(
    FACTORY,
    [
      'function implementationMaster() view returns (address)',
      'function createLMSRWithTWAP(address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, address whitelist, uint256 funding) returns (address)',
      'event LMSRWithTWAPCreation(address indexed creator, address lmsrWithTWAP, address pmSystem, address collateralToken, bytes32[] conditionIds, uint64 fee, uint256 funding)',
    ],
    wallet
  )
  const impl = await factory.implementationMaster()
  if (!same(impl, EXPECTED_IMPL)) throw new Error(`factory implementation ${impl} is not the H-01 master`)

  const creator = new ethers.Contract(
    MISSION_CREATOR,
    [
      'function owner() view returns (address)',
      'function missionTable() view returns (address)',
      'function jbProjects() view returns (address)',
      'function createMission(uint256 teamId, address to, string projectUri, uint256 fundingGoal, uint256 deadline, uint256 refundPeriod, bool token, string tokenName, string tokenSymbol, string memo) returns (uint256)',
      'function missionIdToProjectId(uint256) view returns (uint256)',
      'function missionIdToPayHook(uint256) view returns (address)',
      'event MissionCreated(uint256 indexed id, uint256 indexed teamId, uint256 indexed projectId, address tokenAddress, uint256 fundingGoal)',
    ],
    wallet
  )
  const creatorOwner = await creator.owner()
  if (!same(creatorOwner, wallet.address)) {
    throw new Error(`mission creator owner ${creatorOwner} is not the deployer`)
  }
  const missionTable = await creator.missionTable()
  console.log('deprize mission table', missionTable)

  const n = TEAM_IDS.length
  const funding = FUNDING_PER_OUTCOME.mul(n)
  const conditionId = ethers.utils.keccak256(
    ethers.utils.solidityPack(['address', 'bytes32', 'uint256'], [TREASURY, questionId, n])
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
  const onChainCondition = await ctf.getConditionId(TREASURY, questionId, n)
  if (!same(onChainCondition, conditionId)) {
    throw new Error(`packed condition ${conditionId} != contract ${onChainCondition}`)
  }
  const existingSlots = await ctf.getOutcomeSlotCount(conditionId)
  console.log('conditionId', conditionId, 'existing slots', existingSlots.toString())
  console.log('seed', ethers.utils.formatEther(funding), 'ETH')

  const balance = await provider.getBalance(wallet.address)
  console.log('balance', ethers.utils.formatEther(balance), 'ETH')
  const reserve = funding.add(ethers.utils.parseEther('0.02'))
  if (balance.lt(reserve)) {
    const message = `deployer has ${ethers.utils.formatEther(balance)} ETH, need at least ${ethers.utils.formatEther(reserve)} for the 0.056 ETH seed plus gas`
    if (process.env.CONFIRM === 'arbitrum') throw new Error(message)
    console.log(message)
    console.log('dry run only. Fund the deployer, then set CONFIRM=arbitrum to broadcast.')
    return
  }

  if (process.env.CONFIRM !== 'arbitrum') {
    console.log('dry run only. Set CONFIRM=arbitrum to broadcast.')
    return
  }

  const row = loadRow()
  row.questionId = questionId
  row.conditionId = conditionId
  row.complianceSigner = signer
  row.teamIds = TEAM_IDS
  row.fundingWei = funding.toString()
  if (!row.sunset) {
    row.sunset = Math.floor(Date.now() / 1000) + 2 * 365 * 24 * 3600
  }
  save(row)

  const registryArt = artifact('DePrizeRegistry.sol/DePrizeRegistry.json')
  const mintArt = artifact('DePrizeMint.sol/DePrizeMint.json')
  const redeemArt = artifact('DePrizeRedeem.sol/DePrizeRedeem.json')

  const registryAddr = await deploy(
    wallet,
    'DePrizeRegistry',
    registryArt.abi,
    registryArt.bytecode,
    [EXECUTIVE],
    row,
    'registry'
  )
  const registry = new ethers.Contract(
    registryAddr,
    [
      'function owner() view returns (address)',
      'function count() view returns (uint256)',
      'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
      'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
      'function open(uint256 deprizeId)',
    ],
    provider
  )
  if (!same(await registry.owner(), EXECUTIVE)) throw new Error('registry owner is not the executive branch')

  const mintAddr = await deploy(
    wallet,
    'DePrizeMint',
    mintArt.abi,
    mintArt.bytecode,
    [EXECUTIVE, registryAddr, JB_TERMINAL, WETH, CTF],
    row,
    'mint'
  )
  const mint = new ethers.Contract(
    mintAddr,
    [
      'function owner() view returns (address)',
      'function registry() view returns (address)',
      'function setMarket(uint256 deprizeId, address market)',
      'function setComplianceSigner(address complianceSigner)',
    ],
    provider
  )
  if (!same(await mint.owner(), EXECUTIVE)) throw new Error('mint owner is not the executive branch')
  if (!same(await mint.registry(), registryAddr)) throw new Error('mint registry mismatch')

  const redeemAddr = await deploy(
    wallet,
    'DePrizeRedeem',
    redeemArt.abi,
    redeemArt.bytecode,
    [registryAddr, CTF, WETH],
    row,
    'redeem'
  )
  const redeem = new ethers.Contract(
    redeemAddr,
    ['function registry() view returns (address)', 'function ctf() view returns (address)', 'function weth() view returns (address)'],
    provider
  )
  if (!same(await redeem.registry(), registryAddr)) throw new Error('redeem registry mismatch')
  if (!same(await redeem.ctf(), CTF)) throw new Error('redeem ctf mismatch')
  if (!same(await redeem.weth(), WETH)) throw new Error('redeem weth mismatch')

  if (existingSlots.eq(0) && !row.conditionPrepared) {
    await send(ctf, 'prepareCondition', [TREASURY, questionId, n])
    row.conditionPrepared = true
    save(row)
  }
  const slots = await ctf.getOutcomeSlotCount(conditionId)
  if (!slots.eq(n)) throw new Error(`condition slots ${slots} != ${n}`)
  row.conditionPrepared = true
  save(row)
  console.log('condition ready', conditionId)

  const weth = new ethers.Contract(
    WETH,
    [
      'function deposit() payable',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function balanceOf(address) view returns (uint256)',
      'function withdraw(uint256)',
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
    'function collateralToken() view returns (address)',
    'function pmSystem() view returns (address)',
    'function transferOwnership(address newOwner)',
  ]

  if (!row.market) {
    const wethBal = await weth.balanceOf(wallet.address)
    if (wethBal.lt(funding)) {
      await send(weth, 'deposit', [], { valueOverride: funding.sub(wethBal) })
    }
    await send(weth, 'approve', [FACTORY, funding])
    const receipt = await send(factory, 'createLMSRWithTWAP', [CTF, WETH, [conditionId], FEE, ZERO, funding])
    const created = receipt.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log)
        } catch {
          return undefined
        }
      })
      .find((parsed) => parsed && parsed.name === 'LMSRWithTWAPCreation')
    if (!created) throw new Error('LMSRWithTWAPCreation missing')
    row.market = created.args.lmsrWithTWAP
    save(row)
    console.log('market', row.market)
  }

  const market = new ethers.Contract(row.market, lmsrAbi, wallet)
  const marketOwner = await market.owner()
  if (same(marketOwner, wallet.address)) {
    await send(market, 'transferOwnership', [EXECUTIVE])
  } else if (!same(marketOwner, EXECUTIVE)) {
    throw new Error(`market owner ${marketOwner} is neither the deployer nor the executive branch`)
  }
  row.marketOwner = EXECUTIVE
  save(row)

  const [stage, marketFee, marketFunding, marketSlots, marketCondition, marketCtf, marketWeth, finalOwner] =
    await Promise.all([
      market.stage(),
      market.fee(),
      market.funding(),
      market.atomicOutcomeSlotCount(),
      market.conditionIds(0),
      market.pmSystem(),
      market.collateralToken(),
      market.owner(),
    ])
  if (!stage.eq(0)) throw new Error(`market stage ${stage}`)
  if (!marketFee.eq(FEE)) throw new Error(`market fee ${marketFee}`)
  if (!marketFunding.eq(funding)) throw new Error(`market funding ${marketFunding}`)
  if (!marketSlots.eq(n)) throw new Error(`market slots ${marketSlots}`)
  if (!same(marketCondition, conditionId)) throw new Error('market condition mismatch')
  if (!same(marketCtf, CTF) || !same(marketWeth, WETH)) throw new Error('market collateral mismatch')
  if (!same(finalOwner, EXECUTIVE)) throw new Error('market was not transferred to the executive branch')

  if (!row.jbProjectId) {
    const receipt = await send(creator, 'createMission', [
      0,
      EXECUTIVE,
      'https://moondao.com/deprize/shared-next-landing',
      ethers.utils.parseEther('100'),
      row.sunset,
      30 * 24 * 3600,
      true,
      'DePrize Touchdown',
      'DTCH2',
      'DePrize Next lunar landing',
    ])
    const created = receipt.logs
      .map((log) => {
        try {
          return creator.interface.parseLog(log)
        } catch {
          return undefined
        }
      })
      .find((parsed) => parsed && parsed.name === 'MissionCreated')
    if (!created) throw new Error('MissionCreated missing')
    row.missionId = created.args.id.toString()
    row.jbProjectId = created.args.projectId.toString()
    row.payHook = await creator.missionIdToPayHook(created.args.id)
    save(row)
    console.log('mission', row.missionId, 'jb', row.jbProjectId, 'payHook', row.payHook)
  }

  const payhook = new ethers.Contract(
    row.payHook,
    ['function owner() view returns (address)', 'function deprizeRegistry() view returns (address)', 'function setDePrizeRegistry(address registry)'],
    provider
  )
  const hookOwner = await payhook.owner()
  if (!same(hookOwner, EXECUTIVE)) throw new Error(`pay hook owner ${hookOwner} is not the executive branch`)
  const projects = new ethers.Contract(await creator.jbProjects(), ['function ownerOf(uint256) view returns (address)'], provider)
  const projectOwner = await projects.ownerOf(row.jbProjectId)
  if (!same(projectOwner, EXECUTIVE)) throw new Error(`project owner ${projectOwner} is not the executive branch`)

  const count = await registry.count()
  if (!count.eq(0)) {
    throw new Error(`registry count is ${count}, so the Safe batch cannot assume deprize id 1`)
  }

  const registerCall = registry.interface.encodeFunctionData('register', [row.jbProjectId, TEAM_IDS, row.sunset])
  const setConditionCall = registry.interface.encodeFunctionData('setCondition', [1, conditionId])
  const setMarketCall = mint.interface.encodeFunctionData('setMarket', [1, row.market])
  const setSignerCall = mint.interface.encodeFunctionData('setComplianceSigner', [signer])
  const openCall = registry.interface.encodeFunctionData('open', [1])
  const latchCall = payhook.interface.encodeFunctionData('setDePrizeRegistry', [registryAddr])

  const batch = {
    version: '1.0',
    chainId: String(CHAIN_ID),
    meta: {
      name: 'Open public Touchdown',
      description:
        'Latch the pay hook, register Touchdown, bind the market, set the compliance signer, and open betting. Open is last.',
    },
    transactions: [
      safeTx(row.payHook, latchCall),
      safeTx(registryAddr, registerCall),
      safeTx(registryAddr, setConditionCall),
      safeTx(mintAddr, setMarketCall),
      safeTx(mintAddr, setSignerCall),
      safeTx(registryAddr, openCall),
    ],
  }
  row.safeBatch = batch
  row.verifiedDeployerSteps = true
  save(row)

  console.log('\n=== recorded ===')
  const printable = { ...row }
  delete printable.safeBatch
  console.log(JSON.stringify(printable, null, 2))
  console.log('\n=== executive branch batch (4 of 5) ===')
  console.log(JSON.stringify(batch, null, 2))
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
