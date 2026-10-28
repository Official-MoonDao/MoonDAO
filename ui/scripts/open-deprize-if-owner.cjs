/**
 * If the deployer owns the registry and mint, register + wire + open a prize.
 *
 *   SPEC=scripts/races/touchdown-sepolia.json node scripts/open-deprize-if-owner.cjs
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

function loadPk() {
  if (process.env.DEPLOYER_PK) {
    let pk = process.env.DEPLOYER_PK.trim().replace(/^["']|["']$/g, '')
    if (!pk.startsWith('0x')) pk = `0x${pk}`
    return pk
  }
  const text = fs.readFileSync(path.resolve(__dirname, '../../prediction/.env'), 'utf8')
  const match = text.match(/^DEPLOYER_PK=(.*)$/m)
  if (!match) throw new Error('DEPLOYER_PK missing')
  let pk = match[1].trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk
}

function rpcUrl(spec) {
  if (spec.chainId === 11155111) {
    return process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com'
  }
  if (spec.chainId === 42161) {
    return process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
  }
  throw new Error(`unsupported chain ${spec.chainId}`)
}

function outPath(spec) {
  const slug = spec.question.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return path.resolve('/tmp', `deprize-race-${slug}.json`)
}

async function send(contract, method, args) {
  const gas = await contract.estimateGas[method](...args)
  const tx = await contract[method](...args, { gasLimit: gas.mul(12).div(10) })
  console.log(' tx', method, tx.hash)
  const receipt = await tx.wait()
  if (receipt.status !== 1) throw new Error(`${method} reverted ${tx.hash}`)
  return receipt
}

async function main() {
  const specFile = process.env.SPEC || process.argv[2]
  if (!specFile) throw new Error('pass a race spec json path')
  const spec = JSON.parse(fs.readFileSync(path.resolve(specFile), 'utf8'))
  const savedPath = outPath(spec)
  if (!fs.existsSync(savedPath)) throw new Error(`missing ${savedPath}`)
  const row = JSON.parse(fs.readFileSync(savedPath, 'utf8'))
  if (!row.jbProjectId || !row.conditionId || !row.market) {
    throw new Error('provision first: need jbProjectId, conditionId, market')
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl(spec))
  const wallet = new ethers.Wallet(loadPk(), provider)
  const registry = new ethers.Contract(
    spec.registry,
    [
      'function owner() view returns (address)',
      'function count() view returns (uint256)',
      'function getDePrize(uint256) view returns (tuple(uint256 jbProjectId, bytes32 ctfConditionId, uint256 sunset, uint256 winningTeamId, uint256 cancellationNoticeAt, uint8 state, uint256[] teamIds))',
      'function deprizeIdByJBProject(uint256) view returns (uint256)',
      'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
      'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
      'function open(uint256 deprizeId)',
    ],
    wallet
  )
  const mint = new ethers.Contract(
    spec.mint,
    [
      'function owner() view returns (address)',
      'function marketOf(uint256) view returns (address)',
      'function setMarket(uint256 deprizeId, address market)',
      'function setComplianceSigner(address signer)',
    ],
    wallet
  )

  const registryOwner = await registry.owner()
  const mintOwner = await mint.owner()
  console.log('deployer', wallet.address)
  console.log('registry owner', registryOwner)
  console.log('mint owner', mintOwner)
  if (registryOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('deployer is not registry owner; print Safe batch instead')
  }
  if (mintOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('deployer is not mint owner')
  }

  let deprizeId = await registry.deprizeIdByJBProject(row.jbProjectId)
  if (deprizeId.isZero()) {
    await send(registry, 'register', [row.jbProjectId, spec.roster.map((r) => r.teamId), row.sunset])
    deprizeId = await registry.deprizeIdByJBProject(row.jbProjectId)
  }
  if (deprizeId.isZero()) throw new Error('register did not bind the project')
  row.deprizeId = deprizeId.toString()
  console.log('deprizeId', row.deprizeId)

  const prize = await registry.getDePrize(deprizeId)
  if (prize.ctfConditionId === ethers.constants.HashZero) {
    await send(registry, 'setCondition', [deprizeId, row.conditionId])
  }
  const market = await mint.marketOf(deprizeId)
  if (market === ethers.constants.AddressZero) {
    await send(mint, 'setMarket', [deprizeId, row.market])
  }
  await send(mint, 'setComplianceSigner', [wallet.address])

  const after = await registry.getDePrize(deprizeId)
  // 0 NONE, 1 DRAFT, 2 OPEN
  if (after.state === 1) {
    await send(registry, 'open', [deprizeId])
  }
  const opened = await registry.getDePrize(deprizeId)
  console.log('state', opened.state)
  fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  console.log('saved', savedPath)
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
