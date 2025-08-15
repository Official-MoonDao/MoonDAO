import {
  XP_ORACLE_NAME,
  XP_ORACLE_VERSION,
  XP_ORACLE_CHAIN_ID,
  XP_ORACLE_CHAIN,
  XP_ORACLE_ADDRESSES,
  XP_MANAGER_ADDRESSES,
  HAS_VOTING_POWER_VERIFIER_ADDRESSES,
  HAS_VOTED_VERIFIER_ADDRESSES,
} from 'const/config'
import { Wallet, utils as ethersUtils } from 'ethers'
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from 'thirdweb'
import { privateKeyToAccount as twPrivateKeyToAccount } from 'thirdweb/wallets'
import { arbitrum, sepolia } from '@/lib/infura/infuraChains'
import { serverClient } from '@/lib/thirdweb/client'

type Address = `0x${string}`
type Hex = `0x${string}`

function normalizePk(pk?: string): `0x${string}` {
  console.log('pk', pk)
  if (!pk) throw new Error('ORACLE_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

const { keccak256, defaultAbiCoder } = ethersUtils
// Minimal ABI for verifiers to read xpPerClaim
const VERIFIER_ABI = [
  {
    type: 'function',
    name: 'xpPerClaim',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
]

async function fetchVerifierXp(verifierAddress: Address): Promise<bigint> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: verifierAddress,
    abi: VERIFIER_ABI as any,
  })
  const value = (await readContract({
    contract,
    method: 'xpPerClaim',
    params: [],
  })) as string | bigint
  return BigInt(value as any)
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
}): Promise<{ validAfter: bigint; validBefore: bigint; signature: Hex }> {
  if (!XP_ORACLE_NAME || !XP_ORACLE_VERSION) {
    throw new Error('Oracle env not configured')
  }

  const wallet = new Wallet(normalizePk(process.env.XP_ORACLE_SIGNER_PK))

  // Pre-flight: ensure signer is authorized on the oracle
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
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
    params: [wallet.address as Address],
  })) as boolean
  if (!authorized) {
    throw new Error(
      `Oracle signer not authorized: ${
        wallet.address
      }\noracle: ${oracleAddress}\nchainId: ${Number(XP_ORACLE_CHAIN_ID)}`
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
  } as const

  const signature = (await wallet._signTypedData(
    domain as any,
    types as any,
    proof as any
  )) as Hex

  return { validAfter, validBefore, signature }
}

export async function signHasVotingPowerProof(params: {
  user: Address
  minVotingPower: bigint
  // xpAmount removed from caller API; fetched from chain per verifier
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.minVotingPower.toString()])
  ) as Hex

  // Fetch current xp from the verifier on-chain
  const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const xpAmount = await fetchVerifierXp(verifierAddress)

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount,
    validitySeconds: params.validitySeconds,
  })

  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.minVotingPower.toString(),
      xpAmount.toString(), // preserved for backward compatibility; ignored by verifier now
      validAfter.toString(),
      validBefore.toString(),
      signature,
    ]
  ) as Hex

  return {
    validAfter,
    validBefore,
    signature,
    context,
  }
}

export async function signHasVotedProof(params: {
  user: Address
  minVotes: bigint
  // xpAmount removed from caller API; fetched from chain per verifier
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.minVotes.toString()])
  ) as Hex

  // Fetch current xp from the verifier on-chain
  const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const xpAmount = await fetchVerifierXp(verifierAddress)

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount,
    validitySeconds: params.validitySeconds,
  })

  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.minVotes.toString(),
      xpAmount.toString(), // preserved for backward compatibility; ignored by verifier now
      validAfter.toString(),
      validBefore.toString(),
      signature,
    ]
  ) as Hex

  return {
    validAfter,
    validBefore,
    signature,
    context,
  }
}

// Minimal ABI for XPManager.claimXPFor(address,uint256,bytes)
const XP_MANAGER_ABI = [
  {
    type: 'function',
    name: 'claimXPFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'conditionId', type: 'uint256' },
      { name: 'context', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

export async function submitHasVotingPowerClaimFor(params: {
  user: Address
  context: Hex
  verifierId?: bigint
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const relayerPk = normalizePk(process.env.XP_ORACLE_SIGNER_PK)
  const account = twPrivateKeyToAccount({
    client: serverClient,
    privateKey: relayerPk,
  })

  const verifierId = params.verifierId ?? BigInt(2)
  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [minVotingPower, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [minVotingPower])
    ) as Hex

    const oracleContract = getContract({
      client: serverClient,
      chain: twChain,
      address: oracleAddress,
      abi: XP_ORACLE_ABI as any,
    })

    const ok = (await readContract({
      contract: oracleContract,
      method: 'verifyProof',
      params: [
        {
          user: params.user,
          verifier: verifierAddress,
          contextHash,
          xpAmount: xpAmount.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
        },
        signature,
      ],
    })) as boolean

    if (!ok) {
      // Try to recover signer for additional context
      const proofForRecovery = {
        user: params.user,
        verifier: verifierAddress,
        contextHash,
        xpAmount: xpAmount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
      }
      let recovered: string | undefined
      try {
        recovered = ethersUtils.verifyTypedData(
          {
            name: XP_ORACLE_NAME,
            version: XP_ORACLE_VERSION,
            chainId: Number(XP_ORACLE_CHAIN_ID),
            verifyingContract: oracleAddress,
          } as any,
          {
            Proof: [
              { name: 'user', type: 'address' },
              { name: 'verifier', type: 'address' },
              { name: 'contextHash', type: 'bytes32' },
              { name: 'xpAmount', type: 'uint256' },
              { name: 'validAfter', type: 'uint256' },
              { name: 'validBefore', type: 'uint256' },
            ],
          } as any,
          proofForRecovery as any,
          signature as Hex
        )
      } catch {}

      throw new Error(
        `Error - Invalid oracle proof\n\ncontract: ${contractAddress}\nchainId: ${twChain.id}` +
          (recovered ? `\nrecoveredSigner: ${recovered}` : '')
      )
    }
  } catch (e) {
    // Bubble up decode/verify errors to the API layer
    throw e as Error
  }

  const transaction = prepareContractCall({
    contract,
    method: 'claimXPFor' as string,
    params: [params.user, verifierId, params.context],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}

export async function submitHasVotedClaimFor(params: {
  user: Address
  context: Hex
  verifierId?: bigint
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const relayerPk = normalizePk(process.env.XP_ORACLE_SIGNER_PK)
  const account = twPrivateKeyToAccount({
    client: serverClient,
    privateKey: relayerPk,
  })

  const verifierId = params.verifierId ?? BigInt(3)
  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [minVotes, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [minVotes])
    ) as Hex

    const oracleContract = getContract({
      client: serverClient,
      chain: twChain,
      address: oracleAddress,
      abi: XP_ORACLE_ABI as any,
    })

    const ok = (await readContract({
      contract: oracleContract,
      method: 'verifyProof',
      params: [
        {
          user: params.user,
          verifier: verifierAddress,
          contextHash,
          xpAmount: xpAmount.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
        },
        signature,
      ],
    })) as boolean

    if (!ok) {
      const proofForRecovery = {
        user: params.user,
        verifier: verifierAddress,
        contextHash,
        xpAmount: xpAmount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
      }
      let recovered: string | undefined
      try {
        recovered = ethersUtils.verifyTypedData(
          {
            name: XP_ORACLE_NAME,
            version: XP_ORACLE_VERSION,
            chainId: Number(XP_ORACLE_CHAIN_ID),
            verifyingContract: oracleAddress,
          } as any,
          {
            Proof: [
              { name: 'user', type: 'address' },
              { name: 'verifier', type: 'address' },
              { name: 'contextHash', type: 'bytes32' },
              { name: 'xpAmount', type: 'uint256' },
              { name: 'validAfter', type: 'uint256' },
              { name: 'validBefore', type: 'uint256' },
            ],
          } as any,
          proofForRecovery as any,
          signature as Hex
        )
      } catch {}

      throw new Error(
        `Error - Invalid oracle proof\n\ncontract: ${contractAddress}\nchainId: ${twChain.id}` +
          (recovered ? `\nrecoveredSigner: ${recovered}` : '')
      )
    }
  } catch (e) {
    throw e as Error
  }

  const transaction = prepareContractCall({
    contract,
    method: 'claimXPFor' as string,
    params: [params.user, verifierId, params.context],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}
