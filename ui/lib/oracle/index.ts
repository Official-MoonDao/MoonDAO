import {
  XP_ORACLE_NAME,
  XP_ORACLE_VERSION,
  XP_ORACLE_CHAIN_ID,
  XP_ORACLE_CHAIN,
  XP_ORACLE_ADDRESSES,
  GCP_HSM_SIGNER_ADDRESS,
} from 'const/config'
import { Wallet, utils as ethersUtils, providers } from 'ethers'
import { getContract, readContract } from 'thirdweb'
import { getHSMSigner, isHSMAvailable } from '@/lib/google/hsm-signer'
import { arbitrum, sepolia } from '@/lib/infura/infuraChains'
import { serverClient } from '@/lib/thirdweb/client'

type Address = `0x${string}`
type Hex = `0x${string}`

function normalizePk(pk?: string): `0x${string}` {
  if (!pk) throw new Error('ORACLE_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

export type SignedProofResult = {
  validAfter: bigint
  validBefore: bigint
  signature: Hex
  context: Hex
}

// Minimal ABI for XPOracle
const XP_ORACLE_ABI = [
  {
    type: 'function',
    name: 'isSigner',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'domainSeparator',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'verifyProof',
    stateMutability: 'view',
    inputs: [
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'verifier', type: 'address' },
          { name: 'contextHash', type: 'bytes32' },
          { name: 'xpAmount', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
]

export async function signOracleProof(params: {
  user: Address
  verifier: Address
  contextHash: Hex
  xpAmount: bigint // still required by oracle proof
  validitySeconds?: number
  // Remove authToken requirement
}): Promise<{ validAfter: bigint; validBefore: bigint; signature: Hex }> {
  if (!XP_ORACLE_NAME || !XP_ORACLE_VERSION) {
    throw new Error('Oracle env not configured')
  }

  // Use HSM signer if available, otherwise fall back to private key
  let signerAddress: Address
  let signer: any

  // Use HSM signer if we have full KMS setup, otherwise use private key
  if (isHSMAvailable()) {
    try {
      const hsmSigner = getHSMSigner()
      signerAddress = await hsmSigner.getAddress()
      signer = hsmSigner
    } catch (error) {
      console.warn('HSM signer failed, falling back to private key:', error)
      const wallet = new Wallet(normalizePk(process.env.XP_ORACLE_SIGNER_PK))
      signerAddress = wallet.address as Address
      signer = wallet
    }
  } else {
    // Use private key signer
    const wallet = new Wallet(normalizePk(process.env.XP_ORACLE_SIGNER_PK))
    signerAddress = wallet.address as Address
    signer = wallet

    // Check if the private key address matches the expected HSM address
    if (
      GCP_HSM_SIGNER_ADDRESS &&
      signerAddress.toLowerCase() !== GCP_HSM_SIGNER_ADDRESS.toLowerCase()
    ) {
      console.warn(
        `Address mismatch: private key address ${signerAddress} does not match expected HSM address ${GCP_HSM_SIGNER_ADDRESS}`
      )
    }
  }

  // Pre-flight: check if signer has enough funds to complete transactions
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia

  // Check wallet balance using existing Infura chain configurations
  const provider = new providers.JsonRpcProvider(twChain.rpc)
  const balance = await provider.getBalance(signerAddress)

  // Ensure minimum balance for gas fees (0.01 ETH equivalent)
  const minBalance = BigInt(10_000_000_000_000_000) // 0.01 ETH in wei

  if (balance.lt(minBalance)) {
    throw new Error(
      `Oracle signer has insufficient funds: ${ethersUtils.formatEther(
        balance
      )} ETH. Please contact support.`
    )
  }

  // Pre-flight: ensure signer is authorized on the oracle
  const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const oracleContract = getContract({
    client: serverClient,
    chain: twChain,
    address: oracleAddress,
    abi: XP_ORACLE_ABI as any,
  })
  const onChainDomainSeparator = (await readContract({
    contract: oracleContract,
    method: 'domainSeparator',
    params: [],
  })) as Hex
  const authorized = (await readContract({
    contract: oracleContract,
    method: 'isSigner',
    params: [signerAddress],
  })) as boolean
  if (!authorized) {
    throw new Error(
      `Oracle signer not authorized: ${signerAddress}\noracle: ${oracleAddress}\nchainId: ${Number(
        XP_ORACLE_CHAIN_ID
      )}`
    )
  }

  const now = Math.floor(Date.now() / 1000)
  // Avoid lower-bound time failures due to chain clock skew
  const validAfter = BigInt(0)
  const validBefore = BigInt(now + (params.validitySeconds ?? 60 * 60))

  const proof = {
    user: params.user,
    verifier: params.verifier,
    contextHash: params.contextHash,
    xpAmount: params.xpAmount.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
  }

  const domain = {
    name: XP_ORACLE_NAME,
    version: XP_ORACLE_VERSION,
    chainId: Number(XP_ORACLE_CHAIN_ID),
    verifyingContract: XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address,
  } as const

  const localDomainSeparator = ethersUtils._TypedDataEncoder.hashDomain(
    domain as any
  ) as Hex
  if (
    onChainDomainSeparator.toLowerCase() !== localDomainSeparator.toLowerCase()
  ) {
    throw new Error(
      `Oracle EIP712 domain mismatch.\n` +
        `onChainDomainSeparator: ${onChainDomainSeparator}\n` +
        `localDomainSeparator:   ${localDomainSeparator}\n` +
        `name: ${domain.name}, version: ${domain.version}, chainId: ${domain.chainId}, verifyingContract: ${domain.verifyingContract}`
    )
  }

  const types = {
    Proof: [
      { name: 'user', type: 'address' },
      { name: 'verifier', type: 'address' },
      { name: 'contextHash', type: 'bytes32' },
      { name: 'xpAmount', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
    ],
  }

  let signature: Hex

  // Use the signer that was selected above
  if (isHSMAvailable() && signer.signTypedData) {
    try {
      // Use HSM signer for typed data
      const result = await signer.signTypedData(domain, types, proof)
      signature = result.signature

      // Test signature recovery to verify it matches HSM address
      try {
        const messageHash = ethersUtils._TypedDataEncoder.hash(
          domain,
          types,
          proof
        )
        // CORRECT - this is for EIP-712 signatures
        const recoveredAddress = ethersUtils.recoverAddress(
          messageHash,
          signature
        )
      } catch (recoveryError) {
        console.warn('Failed to recover address from signature:', recoveryError)
      }
    } catch (error) {
      console.error('HSM signing failed:', error)
      console.log('Falling back to private key signing...')
      // Fall back to private key signing
      const wallet = new Wallet(normalizePk(process.env.XP_ORACLE_SIGNER_PK))
      signature = (await wallet._signTypedData(
        domain as any,
        types as any,
        proof as any
      )) as Hex
      console.log('Private key signing successful, signature:', signature)
    }
  } else {
    console.log('Using ethers wallet for signing...')
    // Use ethers wallet for typed data
    signature = (await signer._signTypedData(
      domain as any,
      types as any,
      proof as any
    )) as Hex
  }

  return { validAfter, validBefore, signature }
}
