/**
 * Deploy immutable DePrize v2 registry, mint, and redeem.
 *
 *   CONFIRM=sepolia OWNER=0x... node scripts/deploy-deprize-v2-stack.cjs
 *   CONFIRM=arbitrum OWNER=0x... node scripts/deploy-deprize-v2-stack.cjs
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
    weth: '0x8cfF28F922AeEe80d3a0663e735681469F7374c6',
    ctf: '0xC3B0a34fb9a1c5F9464D7249BF564117e1fe6dE8',
    jbTerminal: '0x2dB6d704058E552DeFE415753465df8dF0361846',
  },
  arbitrum: {
    chainId: 42161,
    rpc: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    ctf: '0x12DAC07Bf586E06a9bDa32c422864C8Fda43FA29',
    jbTerminal: '0x2dB6d704058E552DeFE415753465df8dF0361846',
  },
}

const ARTIFACTS = path.resolve(__dirname, '../../subscription-contracts/out')

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
  return `/tmp/deprize-v2-stack-${name}.json`
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
    gasLimit: gas.mul(12).div(10),
    ...(await feeOverrides(wallet)),
  })
  console.log(' tx', name, sent.hash)
  const receipt = await sent.wait()
  if (receipt.status !== 1) throw new Error(`${name} reverted ${sent.hash}`)
  const address = ethers.utils.getAddress(receipt.contractAddress)
  console.log(name, address, 'block', receipt.blockNumber)
  return { address, tx: sent.hash, block: receipt.blockNumber }
}

async function main() {
  const name = process.env.CONFIRM
  const chain = CHAINS[name]
  if (!chain) throw new Error('set CONFIRM=sepolia or CONFIRM=arbitrum')
  const owner = process.env.OWNER
  if (!ethers.utils.isAddress(owner || '')) throw new Error('set OWNER to the constructor owner')

  const provider = new ethers.providers.JsonRpcProvider(chain.rpc)
  const network = await provider.getNetwork()
  if (network.chainId !== chain.chainId) throw new Error(`expected ${chain.chainId}, got ${network.chainId}`)
  const wallet = new ethers.Wallet(loadPk(), provider)
  const bal = await provider.getBalance(wallet.address)
  console.log('chain', name)
  console.log('deployer', wallet.address)
  console.log('owner', owner)
  console.log('balance', ethers.utils.formatEther(bal), 'ETH')
  if (bal.lt(ethers.utils.parseEther(name === 'arbitrum' ? '0.0004' : '0.02'))) {
    throw new Error(`deployer balance ${ethers.utils.formatEther(bal)} is short of the ${name} deploy reserve`)
  }

  const savedPath = outPath(name)
  const row = fs.existsSync(savedPath) ? JSON.parse(fs.readFileSync(savedPath, 'utf8')) : { chain: name, owner }

  if (!row.registry) {
    const art = artifact('DePrizeRegistry.sol/DePrizeRegistry.json')
    const deployed = await deploy(wallet, 'DePrizeRegistry', art.abi, art.bytecode, [owner])
    row.registry = deployed.address
    row.registryTx = deployed.tx
    row.registryBlock = deployed.block
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  } else {
    console.log('DePrizeRegistry', row.registry, '(already deployed)')
  }

  const registry = new ethers.Contract(row.registry, ['function owner() view returns (address)'], provider)
  const registryOwner = await registry.owner()
  if (registryOwner.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`registry owner ${registryOwner} is not ${owner}`)
  }

  if (!row.mint) {
    const art = artifact('DePrizeMint.sol/DePrizeMint.json')
    const deployed = await deploy(wallet, 'DePrizeMint', art.abi, art.bytecode, [
      owner,
      row.registry,
      chain.jbTerminal,
      chain.weth,
      chain.ctf,
    ])
    row.mint = deployed.address
    row.mintTx = deployed.tx
    row.mintBlock = deployed.block
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  } else {
    console.log('DePrizeMint', row.mint, '(already deployed)')
  }

  if (!row.redeem) {
    const art = artifact('DePrizeRedeem.sol/DePrizeRedeem.json')
    const deployed = await deploy(wallet, 'DePrizeRedeem', art.abi, art.bytecode, [
      row.registry,
      chain.ctf,
      chain.weth,
    ])
    row.redeem = deployed.address
    row.redeemTx = deployed.tx
    row.redeemBlock = deployed.block
    fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  } else {
    console.log('DePrizeRedeem', row.redeem, '(already deployed)')
  }

  fs.writeFileSync(savedPath, JSON.stringify(row, null, 2))
  console.log('saved', savedPath)
  console.log(JSON.stringify(row, null, 2))
}

main().catch((err) => {
  console.error(err.reason || err.message || err)
  process.exit(1)
})
