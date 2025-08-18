import {
  XP_ORACLE_NAME,
  XP_ORACLE_VERSION,
  XP_ORACLE_CHAIN_ID,
  XP_ORACLE_CHAIN,
  XP_ORACLE_ADDRESSES,
  XP_MANAGER_ADDRESSES,
  HAS_VOTING_POWER_VERIFIER_ADDRESSES,
  HAS_VOTED_VERIFIER_ADDRESSES,
  HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES,
  HAS_CREATED_A_TEAM_VERIFIER_ADDRESSES,
} from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from 'thirdweb'
import { Address, Hex } from 'thirdweb'
import { privateKeyToAccount as twPrivateKeyToAccount } from 'thirdweb/wallets'
import { arbitrum, sepolia } from '@/lib/infura/infuraChains'
import { serverClient } from '@/lib/thirdweb/client'
import { signOracleProof } from '../oracle'

function normalizePk(pk?: string): `0x${string}` {
  if (!pk) throw new Error('ORACLE_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

const { keccak256, defaultAbiCoder } = ethersUtils

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

// Minimal ABIs for read helpers
const XP_MANAGER_READ_ABI = [
  {
    type: 'function',
    name: 'usedProofs',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'verifiers',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
] as const

const VERIFIER_READ_ABI = [
  {
    type: 'function',
    name: 'claimId',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'context', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

const VERIFIER_ABI = [
  {
    type: 'function',
    name: 'xpPerClaim',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
]

// ABI for staged verifier functions
const STAGED_VERIFIER_ABI = [
  {
    type: 'function',
    name: 'isBulkEligible',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'context', type: 'bytes' },
    ],
    outputs: [
      { name: 'eligible', type: 'bool' },
      { name: 'totalXP', type: 'uint256' },
      { name: 'highestStage', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'bulkClaimId',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'context', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getUserHighestStage',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

/**
 * Check whether a user has already claimed XP from a given verifier/context.
 * Works with any IXPVerifier implementation as long as you supply the exact context
 * that the verifier expects for its claimId derivation.
 */
export async function hasClaimedFromVerifier(params: {
  user: Address
  context: Hex
  verifierAddress?: Address
  verifierId?: bigint
  xpManager?: Address
}): Promise<boolean> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia

  const xpManagerAddress =
    params.xpManager || (XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address)
  if (!xpManagerAddress) throw new Error('XP Manager address not configured')

  // Resolve verifier address if only an id is provided
  let verifierAddress = params.verifierAddress
  if (!verifierAddress) {
    if (params.verifierId === undefined)
      throw new Error('Provide verifierAddress or verifierId')

    const xpManagerContract = getContract({
      client: serverClient,
      chain: twChain,
      address: xpManagerAddress,
      abi: XP_MANAGER_READ_ABI as any,
    })
    verifierAddress = (await readContract({
      contract: xpManagerContract,
      method: 'verifiers',
      params: [params.verifierId],
    })) as Address

    if (
      !verifierAddress ||
      verifierAddress === '0x0000000000000000000000000000000000000000'
    )
      throw new Error('Verifier not found for provided id')
  }

  // Compute claimId via the verifier
  const verifierContract = getContract({
    client: serverClient,
    chain: twChain,
    address: verifierAddress as Address,
    abi: VERIFIER_READ_ABI as any,
  })

  const claimId = (await readContract({
    contract: verifierContract,
    method: 'claimId',
    params: [params.user, params.context],
  })) as Hex

  // Check XPManager.usedProofs(claimId)
  const xpManagerRead = getContract({
    client: serverClient,
    chain: twChain,
    address: xpManagerAddress,
    abi: XP_MANAGER_READ_ABI as any,
  })

  const alreadyClaimed = (await readContract({
    contract: xpManagerRead,
    method: 'usedProofs',
    params: [claimId],
  })) as boolean

  return alreadyClaimed
}

/**
 * Check bulk eligibility for a staged verifier - see what stages user can claim and total XP
 */
export async function checkBulkEligibility(params: {
  user: Address
  context: Hex
  verifierAddress: Address
}): Promise<{
  eligible: boolean
  totalXP: bigint
  highestStage: bigint
  alreadyClaimed: boolean
}> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia

  const verifierContract = getContract({
    client: serverClient,
    chain: twChain,
    address: params.verifierAddress,
    abi: STAGED_VERIFIER_ABI as any,
  })

  // Check bulk eligibility
  const [eligible, totalXP, highestStage] = (await readContract({
    contract: verifierContract,
    method: 'isBulkEligible',
    params: [params.user, params.context],
  })) as [boolean, bigint, bigint]

  // Check if already claimed using bulk claim ID
  const bulkClaimId = (await readContract({
    contract: verifierContract,
    method: 'bulkClaimId',
    params: [params.user, params.context],
  })) as Hex

  const xpManagerAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const xpManagerContract = getContract({
    client: serverClient,
    chain: twChain,
    address: xpManagerAddress,
    abi: XP_MANAGER_READ_ABI as any,
  })

  const alreadyClaimed = (await readContract({
    contract: xpManagerContract,
    method: 'usedProofs',
    params: [bulkClaimId],
  })) as boolean

  return {
    eligible,
    totalXP,
    highestStage,
    alreadyClaimed,
  }
}

export function useHasClaimedFromVerifier(params: {
  user?: Address
  context?: Hex
  verifierAddress?: Address
  verifierId?: bigint
  xpManager?: Address
}) {
  const { user, context, verifierAddress, verifierId, xpManager } = params
  const [claimed, setClaimed] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const canQuery = useMemo(() => {
    return Boolean(
      user && context && (verifierAddress || typeof verifierId !== 'undefined')
    )
  }, [user, context, verifierAddress, verifierId])

  const refetch = useCallback(async () => {
    if (!canQuery) return
    setIsLoading(true)
    setError(undefined)
    try {
      const result = await hasClaimedFromVerifier({
        user: user as Address,
        context: context as Hex,
        verifierAddress,
        verifierId,
        xpManager,
      })
      if (mountedRef.current) setClaimed(result)
    } catch (e: any) {
      if (mountedRef.current) setError(e as Error)
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [canQuery, user, context, verifierAddress, verifierId, xpManager])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { claimed, isLoading, error, refetch, canQuery }
}

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

export async function signHasVotingPowerProof(params: {
  user: Address
  actualVotingPower: bigint // Changed from minVotingPower to actualVotingPower for clarity
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's actual voting power
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.actualVotingPower.toString()])
  ) as Hex

  const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For staged verifiers, we use 0 as xpAmount since it will be calculated by the contract
  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount: BigInt(0), // XP amount not used in verification for staged verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for staged verifiers: (actualVotingPower, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.actualVotingPower.toString(), // User's actual voting power
      '0', // XP amount not used for staged verifiers
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

export async function signHasCreatedTeamProof(params: {
  user: Address
  actualTeamsCreated: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's actual teams created
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.actualTeamsCreated.toString()])
  ) as Hex

  const verifierAddress = HAS_CREATED_A_TEAM_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For staged verifiers, we use 0 as xpAmount since it will be calculated by the contract
  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount: BigInt(0), // XP amount not used in verification for staged verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for staged verifiers: (actualTeamsCreated, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.actualTeamsCreated.toString(), // User's actual teams created
      '0', // XP amount not used for staged verifiers
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
  actualVotes: bigint // Changed from minVotes to actualVotes for clarity
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's actual vote count
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.actualVotes.toString()])
  ) as Hex

  const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For staged verifiers, we use 0 as xpAmount since it will be calculated by the contract
  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount: BigInt(0), // XP amount not used in verification for staged verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for staged verifiers: (actualVotes, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.actualVotes.toString(), // User's actual vote count
      '0', // XP amount not used for staged verifiers
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

export async function signOwnsCitizenProof(params: {
  user: Address
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

  // For OwnsCitizenNFT, the context only contains the xpAmount (which is ignored by the verifier)
  // We still need to encode it for the contextHash calculation
  const verifierAddress = HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const xpAmount = await fetchVerifierXp(verifierAddress)

  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [xpAmount.toString()])
  ) as Hex

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount,
    validitySeconds: params.validitySeconds,
  })

  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'bytes'],
    [
      xpAmount.toString(), // OwnsCitizenNFT expects just xpAmount in context
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

// Minimal ABI for XPManager.claimXPFor(address,uint256,bytes) and claimBulkXPFor
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
  {
    type: 'function',
    name: 'claimBulkXPFor',
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

  const verifierId = params.verifierId ?? BigInt(0)
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

/**
 * Generic bulk claim function that can be used for any staged verifier
 */
export async function submitBulkClaimFor(params: {
  user: Address
  context: Hex
  verifierId: bigint
  verifierAddress: Address
  xpManager?: Address
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const relayerPk = normalizePk(process.env.XP_ORACLE_SIGNER_PK)
  const account = twPrivateKeyToAccount({
    client: serverClient,
    privateKey: relayerPk,
  })

  const contractAddress =
    params.xpManager || (XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address)
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [actualValue, , validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [actualValue])
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
          verifier: params.verifierAddress,
          contextHash,
          xpAmount: '0', // XP amount is 0 for staged verifiers
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
        verifier: params.verifierAddress,
        contextHash,
        xpAmount: '0',
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
    method: 'claimBulkXPFor' as string,
    params: [params.user, params.verifierId, params.context],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}

export async function submitHasVotingPowerBulkClaimFor(params: {
  user: Address
  context: Hex
  verifierId?: bigint
}): Promise<{ txHash: Hex }> {
  const verifierId = params.verifierId ?? BigInt(0)
  const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function submitHasCreatedTeamClaimFor(params: {
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
    const [teamsCreated, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_CREATED_A_TEAM_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [teamsCreated])
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

  const verifierId = params.verifierId ?? BigInt(1)
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

export async function submitHasVotedBulkClaimFor(params: {
  user: Address
  context: Hex
  verifierId?: bigint
}): Promise<{ txHash: Hex }> {
  const verifierId = params.verifierId ?? BigInt(1)
  const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function submitOwnsCitizenClaimFor(params: {
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

  const verifierId = params.verifierId ?? BigInt(5)
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
    const [xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [xpAmount])
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

/**
 * Submit a token balance claim for a user (no oracle required since verification is on-chain)
 * @param params User address and verifier ID
 * @returns Transaction hash
 */
export async function submitHasTokenBalanceBulkClaimFor(params: {
  user: Address
  verifierId?: bigint
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const relayerPk = normalizePk(process.env.XP_ORACLE_SIGNER_PK)
  const account = twPrivateKeyToAccount({
    client: serverClient,
    privateKey: relayerPk,
  })

  const verifierId = params.verifierId ?? BigInt(2) // Token balance verifier ID
  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // For token balance, we don't need oracle verification since it's checked on-chain
  // We can pass an empty context since the verifier contract handles the logic
  const emptyContext = '0x' as Hex

  const transaction = prepareContractCall({
    contract,
    method: 'claimBulkXPFor' as string,
    params: [params.user, verifierId, emptyContext],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}
