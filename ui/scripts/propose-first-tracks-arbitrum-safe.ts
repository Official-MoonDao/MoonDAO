/**
 * Queue the Arbitrum public First Tracks open batch on the executive Safe.
 *
 * The deployer already prepared the condition, mission, and seeded market.
 * This batch latches the pay hook, registers prize id 2, binds the condition
 * and market, and opens. It does not call setComplianceSigner: that mint
 * already uses the Touchdown signer.
 *
 * Refuses unless registry count() is still 1, so id 2 is the id register
 * will assign. Open is last.
 *
 * Executed 2026-11-25 in tx 0xc1a900fa619d940fc2d254e393ad38b7cf9be7653a6c1c8610043b38a8e308a4.
 * Registry count() is now 2, so this script refuses to run again.
 *
 *   cd ui && yarn
 *   yarn tsx --tsconfig tsconfig.json scripts/propose-first-tracks-arbitrum-safe.ts
 *
 * An owner key is only needed if the HSM is not already a proposer:
 *   SAFE_OWNER_PK=0x<executive-safe-owner> yarn tsx --tsconfig tsconfig.json scripts/propose-first-tracks-arbitrum-safe.ts
 *
 * Never prints keys.
 */
import fs from 'fs'
import path from 'path'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrum } from 'viem/chains'

const CHAIN_ID = 42161n
const RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
const SAFE_ADDRESS = '0xdFc31084ad3887076913e5d0759a27C65A3C5291'
const EXPECTED_HSM = '0xb206325e6562517532686dfeeead4c104d9f5d32'
const REGISTRY = '0x5620749d0579ff08D0DD2389CF9040523DD7B8ea'
const MINT = '0x1D58652aC8dF5dDc762F0D2b531BA3f178f67765'
const PAY_HOOK = '0xe668A95289A8B736FC2e500A98Bae3417DBAf350'
const MARKET = '0xb71E299b98dC6e0DAa65750CB9aa942348120Bf6'
const CONDITION = '0x380b57c4342eef02f49e3231460de2a70afec134f5a7aadd7ad7d8ac33595756'
const JB_PROJECT = 88
const SUNSET = 1858641089
const TEAM_IDS = [631, 632, 633, 634, 635, 24]
const DEPRIZE_ID = 2

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function normalizePk(raw: string) {
  let pk = raw.trim().replace(/^["']|["']$/g, '')
  if (!pk.startsWith('0x')) pk = `0x${pk}`
  return pk as `0x${string}`
}

function batch() {
  const registry = new ethers.utils.Interface([
    'function register(uint256 jbProjectId, uint256[] teamIds, uint256 sunset) returns (uint256)',
    'function setCondition(uint256 deprizeId, bytes32 ctfConditionId)',
    'function open(uint256 deprizeId)',
  ])
  const mint = new ethers.utils.Interface([
    'function setMarket(uint256 deprizeId, address market)',
  ])
  const hook = new ethers.utils.Interface(['function setDePrizeRegistry(address registry)'])
  return [
    { to: PAY_HOOK, value: '0', data: hook.encodeFunctionData('setDePrizeRegistry', [REGISTRY]) },
    {
      to: REGISTRY,
      value: '0',
      data: registry.encodeFunctionData('register', [JB_PROJECT, TEAM_IDS, SUNSET]),
    },
    {
      to: REGISTRY,
      value: '0',
      data: registry.encodeFunctionData('setCondition', [DEPRIZE_ID, CONDITION]),
    },
    { to: MINT, value: '0', data: mint.encodeFunctionData('setMarket', [DEPRIZE_ID, MARKET]) },
    { to: REGISTRY, value: '0', data: registry.encodeFunctionData('open', [DEPRIZE_ID]) },
  ]
}

function safeEthSign(personalSig: string, safeTxHash: string, signer: string) {
  const recovered = ethers.utils.recoverAddress(safeTxHash, personalSig)
  if (recovered.toLowerCase() === signer.toLowerCase()) return personalSig
  const v = parseInt(personalSig.slice(-2), 16) + 4
  if (v > 255) throw new Error('signature v is out of range')
  return personalSig.slice(0, -2) + v.toString(16).padStart(2, '0')
}

async function hsmIsProposer(apiKit: SafeApiKit, hsm: string) {
  const page = await apiKit.getSafeDelegates({ safeAddress: SAFE_ADDRESS })
  const results = (page as { results?: Array<{ delegate?: string }> }).results ?? []
  return results.some((row) => row.delegate?.toLowerCase() === hsm.toLowerCase())
}

async function addProposer(hsm: string) {
  const raw = process.env.SAFE_OWNER_PK
  if (!raw) return false
  const pk = normalizePk(raw)
  const account = privateKeyToAccount(pk)
  const provider = new ethers.providers.JsonRpcProvider(RPC)
  const safe = new ethers.Contract(
    SAFE_ADDRESS,
    ['function getOwners() view returns (address[])'],
    provider
  )
  const owners: string[] = await safe.getOwners()
  if (!owners.some((owner) => owner.toLowerCase() === account.address.toLowerCase())) {
    throw new Error(`${account.address} is not an owner of the executive Safe`)
  }
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID })
  if (await hsmIsProposer(apiKit, hsm)) {
    console.log('HSM is already a proposer')
    return true
  }
  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport: http(RPC),
  })
  await apiKit.addSafeDelegate({
    safeAddress: SAFE_ADDRESS,
    delegateAddress: hsm,
    delegatorAddress: account.address,
    label: 'GCP HSM',
    signer: walletClient,
  })
  console.log('added proposer', hsm, 'delegated by', account.address)
  return true
}

async function assertNextId() {
  const provider = new ethers.providers.JsonRpcProvider(RPC)
  const registry = new ethers.Contract(
    REGISTRY,
    [
      'function count() view returns (uint256)',
      'function deprizeIdByJBProject(uint256) view returns (uint256)',
    ],
    provider
  )
  const market = new ethers.Contract(MARKET, ['function owner() view returns (address)'], provider)
  const count = await registry.count()
  if (!count.eq(1)) {
    throw new Error(`registry count is ${count.toString()}, so id 2 is no longer the next register`)
  }
  const bound = await registry.deprizeIdByJBProject(JB_PROJECT)
  if (!bound.isZero()) {
    throw new Error(`Juicebox project ${JB_PROJECT} is already prize ${bound.toString()}`)
  }
  const owner = await market.owner()
  if (owner.toLowerCase() !== SAFE_ADDRESS.toLowerCase()) {
    throw new Error(`market owner ${owner} is not the executive Safe`)
  }
}

async function propose(senderPk: string, senderAddress: string, transactions: ReturnType<typeof batch>) {
  const protocolKit = await Safe.init({
    provider: RPC,
    signer: senderPk,
    safeAddress: SAFE_ADDRESS,
  })
  const safeTransaction = await protocolKit.createTransaction({ transactions })
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction)
  const signature = await protocolKit.signHash(safeTxHash)
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID })
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress,
    senderSignature: signature.data,
    origin: 'arbitrum-first-tracks-public',
  })
  console.log('proposed', safeTxHash)
  console.log(
    `https://app.safe.global/transactions/tx?safe=arb1:${SAFE_ADDRESS}&id=multisig_${SAFE_ADDRESS}_${safeTxHash}`
  )
}

async function proposeFromHsm(transactions: ReturnType<typeof batch>) {
  const { getHSMSigner, isHSMAvailable } = await import('../lib/google/hsm-signer')
  if (!isHSMAvailable()) {
    throw new Error(
      'Set SAFE_OWNER_PK to an executive Safe owner key. This machine has no HSM credentials to propose with.'
    )
  }
  const hsm = getHSMSigner()
  const hsmAddress = ethers.utils.getAddress(await hsm.getAddress())
  if (hsmAddress.toLowerCase() !== EXPECTED_HSM.toLowerCase()) {
    throw new Error(`HSM address ${hsmAddress} is not ${EXPECTED_HSM}`)
  }
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID })
  if (!(await hsmIsProposer(apiKit, hsmAddress))) {
    throw new Error('HSM is not a proposer yet. An executive Safe owner runs this with SAFE_OWNER_PK set.')
  }
  const protocolKit = await Safe.init({
    provider: RPC,
    signer: hsmAddress,
    safeAddress: SAFE_ADDRESS,
  })
  const safeTransaction = await protocolKit.createTransaction({ transactions })
  const safeTxHash = await protocolKit.getTransactionHash(safeTransaction)
  const personal = await hsm.signMessage(ethers.utils.arrayify(safeTxHash))
  const senderSignature = safeEthSign(personal, safeTxHash, hsmAddress)
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: hsmAddress,
    senderSignature,
    origin: 'arbitrum-first-tracks-public',
  })
  console.log('proposed', safeTxHash)
  console.log(
    `https://app.safe.global/transactions/tx?safe=arb1:${SAFE_ADDRESS}&id=multisig_${SAFE_ADDRESS}_${safeTxHash}`
  )
}

async function main() {
  loadEnvLocal()
  await assertNextId()
  const hsmAddress = ethers.utils.getAddress(EXPECTED_HSM)
  const transactions = batch()
  console.log('Safe', SAFE_ADDRESS)
  console.log('HSM proposer', hsmAddress)
  transactions.forEach((tx, i) => console.log(`${i + 1}`, tx.to, tx.data))

  const raw = process.env.SAFE_OWNER_PK
  if (raw) {
    const pk = normalizePk(raw)
    const owner = new ethers.Wallet(pk).address
    await addProposer(hsmAddress)
    console.log('owner', owner, 'proposing the batch')
    await propose(pk, owner, transactions)
    return
  }

  await proposeFromHsm(transactions)
}

main().catch((err) => {
  console.error(err?.reason || err?.message || err)
  process.exit(1)
})
