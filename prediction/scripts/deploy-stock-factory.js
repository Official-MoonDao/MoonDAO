/**
 * Deploy the unmodified Gnosis LMSRMarketMakerFactory (solc 0.5.1) on a
 * network that already has ConditionalTokens + WETH. Links Fixed192x64Math
 * from the committed creation bytecode used by StockLmsrFork.
 *
 *   source .env   # DEPLOYER_PK, SEPOLIA_RPC
 *   node scripts/deploy-stock-factory.js
 */
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { createPublicClient, createWalletClient, http } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')
const { sepolia } = require('viem/chains')

const FIXTURES = join(
  __dirname,
  '../../subscription-contracts/test/deprize/fixtures/gnosis'
)
const PLACEHOLDER = '__Fixed192x64Math_______________________'

function pk() {
  const raw = process.env.DEPLOYER_PK || process.env.PRIVATE_KEY
  if (!raw) throw new Error('Set DEPLOYER_PK or PRIVATE_KEY')
  return (raw.startsWith('0x') ? raw : `0x${raw}`)
}

function rpcUrl() {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.SEPOLIA_RPC ||
    'https://ethereum-sepolia-rpc.publicnode.com'
  )
}

function hexFile(name) {
  const raw = readFileSync(join(FIXTURES, name), 'utf8').trim()
  return raw.startsWith('0x') ? raw : `0x${raw}`
}

function link(factoryHex, library) {
  const addr = library.slice(2).toLowerCase()
  if (addr.length !== 40) throw new Error(`bad library address ${library}`)
  const body = factoryHex.slice(2)
  if (!body.includes(PLACEHOLDER)) {
    throw new Error('factory bytecode has no Fixed192x64Math placeholder')
  }
  return `0x${body.split(PLACEHOLDER).join(addr)}`
}

async function main() {
  const account = privateKeyToAccount(pk())
  const rpc = rpcUrl()
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

  const libHash = await wallet.deployContract({
    abi: [],
    bytecode: hexFile('Fixed192x64Math.bin'),
  })
  const libReceipt = await publicClient.waitForTransactionReceipt({ hash: libHash })
  if (libReceipt.status !== 'success' || !libReceipt.contractAddress) {
    throw new Error(`Fixed192x64Math deploy failed ${libHash}`)
  }
  const library = libReceipt.contractAddress
  console.log('Fixed192x64Math', library, 'tx', libHash)

  const factoryBytecode = link(hexFile('LMSRMarketMakerFactory.bin'), library)
  const facHash = await wallet.deployContract({
    abi: [],
    bytecode: factoryBytecode,
  })
  const facReceipt = await publicClient.waitForTransactionReceipt({ hash: facHash })
  if (facReceipt.status !== 'success' || !facReceipt.contractAddress) {
    throw new Error(`LMSRMarketMakerFactory deploy failed ${facHash}`)
  }
  const factory = facReceipt.contractAddress
  console.log('LMSRMarketMakerFactory', factory, 'tx', facHash)

  const implementationMaster = await publicClient.readContract({
    address: factory,
    abi: [
      {
        type: 'function',
        name: 'implementationMaster',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address' }],
      },
    ],
    functionName: 'implementationMaster',
  })
  console.log('implementationMaster', implementationMaster)

  const out = {
    chainId: 11155111,
    deployer: account.address,
    Fixed192x64Math: library,
    LMSRMarketMakerFactory: factory,
    implementationMaster,
    txs: { library: libHash, factory: facHash },
  }
  writeFileSync('/tmp/sepolia-stock-factory.json', JSON.stringify(out, null, 2))
  console.log('recorded /tmp/sepolia-stock-factory.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
