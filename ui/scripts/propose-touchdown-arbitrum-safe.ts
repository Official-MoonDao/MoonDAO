/**
 * Propose the Arbitrum public Touchdown open batch from the GCP HSM wallet.
 *
 * The executive Safe owns the registry and the mint. The HSM is not an owner.
 * Safe's transaction service only accepts a proposal from an owner or a
 * proposer (delegate). One owner adds the HSM once; the HSM then proposes
 * the six calls as a single transaction the other owners sign.
 *
 *   SAFE_OWNER_PK=0x<executive-safe-owner> \
 *     yarn tsx --tsconfig tsconfig.json scripts/propose-touchdown-arbitrum-safe.ts
 *
 * After the proposer exists, the owner key is no longer required:
 *
 *   yarn tsx --tsconfig tsconfig.json scripts/propose-touchdown-arbitrum-safe.ts
 *
 * Reads GCP_SIGNER_SERVICE_ACCOUNT and GCP_PROJECT_ID from ui/.env.local.
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
const PAY_HOOK = '0xC3051321c106aeEc0926b18084eEfDE073041614'
const MARKET = '0x8dD77065A0934F3Cea5c7b8d58e9F5A966B1Da2d'
const CONDITION = '0x74903435e83c31673d67ceb23e243c99f4a95d0fe451ad2a62d5f4221ae532fa'
const SIGNER = '0x3c5e2fe76478E99d94D3ca8BfA5154907a52E011'
const JB_PROJECT = 87
const SUNSET = 1856458310
const TEAM_IDS = [601, 602, 603, 604, 605, 606, 24]
const DEPRIZE_ID = 1

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
    'function setComplianceSigner(address complianceSigner)',
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
    {
      to: MINT,
      value: '0',
      data: mint.encodeFunctionData('setComplianceSigner', [SIGNER]),
    },
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

async function main() {
  loadEnvLocal()
  const { getHSMSigner, isHSMAvailable } = await import('../lib/google/hsm-signer')
  if (!isHSMAvailable()) {
    throw new Error('GCP_SIGNER_SERVICE_ACCOUNT is missing from ui/.env.local')
  }
  const hsm = getHSMSigner()
  const hsmAddress = ethers.utils.getAddress(await hsm.getAddress())
  if (hsmAddress.toLowerCase() !== EXPECTED_HSM.toLowerCase()) {
    throw new Error(`HSM address ${hsmAddress} is not ${EXPECTED_HSM}`)
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC)
  const registry = new ethers.Contract(
    REGISTRY,
    ['function count() view returns (uint256)'],
    provider
  )
  const count = await registry.count()
  if (!count.isZero()) {
    throw new Error(`registry count is ${count.toString()}, so id 1 is no longer the next register`)
  }

  const transactions = batch()
  console.log('Safe', SAFE_ADDRESS)
  console.log('proposer', hsmAddress)
  transactions.forEach((tx, i) => console.log(`${i + 1}`, tx.to, tx.data.slice(0, 10)))

  await addProposer(hsmAddress)
  const apiKit = new SafeApiKit({ chainId: CHAIN_ID })
  if (!(await hsmIsProposer(apiKit, hsmAddress))) {
    throw new Error(
      'HSM is not a proposer yet. An executive Safe owner runs this same command with SAFE_OWNER_PK set to their owner key.'
    )
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
    origin: 'arbitrum-touchdown-public',
  })
  console.log('proposed', safeTxHash)
  console.log(`https://app.safe.global/transactions/tx?safe=arb1:${SAFE_ADDRESS}&id=multisig_${SAFE_ADDRESS}_${safeTxHash}`)
}

main().catch((err) => {
  console.error(err?.reason || err?.message || err)
  process.exit(1)
})
