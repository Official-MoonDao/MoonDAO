/**
 * Deploy a MissionCreator (TreasuryPayHook inside) plus a fresh MissionTable.
 *
 *   CONFIRM=sepolia node scripts/deploy-mission-creator.cjs
 *   CONFIRM=arbitrum node scripts/deploy-mission-creator.cjs
 *
 * Key: DEPLOYER_PK in ../../prediction/.env. Never printed.
 */
const fs = require('fs')
const path = require('path')
const { ethers } = require('ethers')

const CHAINS = {
  sepolia: {
    chainId: 11155111,
    rpc: process.env.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    team: '0x21d2C4bEBd1AEb830277F8548Ae30F505551f961',
    treasury: '0x0724d0eb7b6d32AEDE6F9e492a5B1436b537262b',
    feeHook: '0x5aCCa043A4a69d394E3258215A30E4430eBC4844',
    positionManager: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
    tableOwner: '0xE5148e4399e3D849F629E0FECEcf6fC986e96127',
  },
  arbitrum: {
    chainId: 42161,
    rpc: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    team: '0xAB2C354eC32880C143e87418f80ACc06334Ff55F',
    treasury: '0xAF26a002d716508b7e375f1f620338442F5470c0',
    feeHook: '0x6D9C97c94c88a67d1A93BBC8ccAe3a5322208844',
    positionManager: '0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869',
    tableOwner: '0xdFc31084ad3887076913e5d0759a27C65A3C5291',
  },
}

const JB = {
  controller: '0x27da30646502e2f642bE5281322Ae8C394F7668a',
  terminal: '0x2dB6d704058E552DeFE415753465df8dF0361846',
  projects: '0x885f707EFA18D2cb12f05a3a8eBA6B4B26c8c1D4',
  terminalStore: '0xfE33B439Ec53748C87DcEDACb83f05aDd5014744',
  rulesets: '0x6292281D69c3593FCF6eA074E5797341476ab428',
}

const ARTIFACTS = path.resolve(__dirname, '../../subscription-contracts/out')
const ZERO = '0x0000000000000000000000000000000000000000'

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

function artifact(rel) {
  const json = JSON.parse(fs.readFileSync(path.join(ARTIFACTS, rel), 'utf8'))
  const bytecode = json.bytecode && json.bytecode.object
  if (!bytecode || bytecode === '0x') throw new Error(`no bytecode in ${rel}`)
  if (bytecode.includes('__$')) throw new Error(`${rel} has unlinked libraries`)
  return { abi: json.abi, bytecode }
}

function outPath(name) {
  return `/tmp/mission-creator-${name}.json`
}

async function feeOverrides(wallet) {
  const network = await wallet.provider.getNetwork()
  if (network.chainId !== 42161) return {}
  const gasPrice = await wallet.provider.getGasPrice()
  const capped = gasPrice.mul(4)
  const floor = ethers.utils.parseUnits('0.05', 'gwei')
  return { gasPrice: capped.gt(floor) ? capped : floor }
}

async function deploy(wallet, name, abi, bytecode, args) {
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const tx = await factory.getDeployTransaction(...args)
  const gas = await wallet.estimateGas(tx)
  const sent = await wallet.sendTransaction({
    ...tx,
    gasLimit: gas.mul(13).div(10),
    ...(await feeOverrides(wallet)),
  })
  console.log(' tx', name, sent.hash)
  const receipt = await sent.wait()
  if (receipt.status !== 1) throw new Error(`${name} reverted ${sent.hash}`)
  const address = ethers.utils.getAddress(receipt.contractAddress)
  console.log(name, address, 'block', receipt.blockNumber)
  return { address, tx: sent.hash, block: receipt.blockNumber }
}

async function send(contract, method, args) {
  const gas = await contract.estimateGas[method](...args)
  const tx = await contract[method](...args, {
    gasLimit: gas.mul(13).div(10),
    ...(await feeOverrides(contract.signer)),
  })
  console.log(' tx', method, tx.hash)
  const receipt = await tx.wait()
  if (receipt.status !== 1) throw new Error(`${method} reverted ${tx.hash}`)
  return receipt
}

async function main() {
  const name = process.env.CONFIRM
  const chain = CHAINS[name]
  if (!chain) throw new Error('set CONFIRM=sepolia or CONFIRM=arbitrum')

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc)
  const network = await provider.getNetwork()
  if (network.chainId !== chain.chainId) throw new Error(`expected ${chain.chainId}, got ${network.chainId}`)
  const wallet = new ethers.Wallet(loadPk(), provider)
  const bal = await provider.getBalance(wallet.address)
  console.log('chain', name)
  console.log('deployer', wallet.address)
  console.log('balance', ethers.utils.formatEther(bal), 'ETH')
  if (bal.lt(ethers.utils.parseEther(name === 'arbitrum' ? '0.0006' : '0.03'))) {
    throw new Error(`deployer balance ${ethers.utils.formatEther(bal)} is short of the ${name} MissionCreator reserve`)
  }

  const savedPath = outPath(name)
  const row = fs.existsSync(savedPath) ? JSON.parse(fs.readFileSync(savedPath, 'utf8')) : { chain: name }

  if (!row.missionCreator) {
    const art = artifact('MissionCreator.sol/MissionCreator.json')
    const deployed = await deploy(wallet, 'MissionCreator', art.abi, art.bytecode, [
      JB.controller,
      JB.terminal,
      JB.projects,
      JB.terminalStore,
      JB.rulesets,
      chain.team,
      ZERO,
      chain.treasury,
      chain.feeHook,
      chain.positionManager,
    ])
    row.missionCreator = deployed.address
    row.missionCreatorTx = deployed.tx
    row.missionCreatorBlock = deployed.block
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  } else {
    console.log('MissionCreator', row.missionCreator, '(already deployed)')
  }

  const creator = new ethers.Contract(
    row.missionCreator,
    [
      'function owner() view returns (address)',
      'function treasuryPayHook() view returns (address)',
      'function setMissionTable(address)',
    ],
    wallet
  )
  row.treasuryPayHook = await creator.treasuryPayHook()
  console.log('TreasuryPayHook', row.treasuryPayHook)

  if (!row.missionTable) {
    const art = artifact('MissionTable.sol/MissionTable.json')
    const deployed = await deploy(wallet, 'MissionTable', art.abi, art.bytecode, [
      'DEPRIZEMISSION',
      row.missionCreator,
    ])
    row.missionTable = deployed.address
    row.missionTableTx = deployed.tx
    row.missionTableBlock = deployed.block
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  } else {
    console.log('MissionTable', row.missionTable, '(already deployed)')
  }

  const table = new ethers.Contract(
    row.missionTable,
    [
      'function owner() view returns (address)',
      'function missionCreator() view returns (address)',
      'function setMoonDaoTeam(address)',
      'function transferOwnership(address)',
    ],
    wallet
  )
  if ((await creator.owner()).toLowerCase() === wallet.address.toLowerCase()) {
    await send(creator, 'setMissionTable', [row.missionTable])
  }
  if ((await table.owner()).toLowerCase() === wallet.address.toLowerCase()) {
    await send(table, 'setMoonDaoTeam', [chain.team])
    if (chain.tableOwner) {
      await send(table, 'transferOwnership', [chain.tableOwner])
    }
  }

  fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  console.log('saved', savedPath)
  console.log(JSON.stringify(row, null, 2))
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
