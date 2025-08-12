import {
  XP_ORACLE_NAME,
  XP_ORACLE_VERSION,
  XP_ORACLE_CHAIN_ID,
  XP_ORACLE_CHAIN,
  XP_ORACLE_ADDRESSES,
  XP_MANAGER_ADDRESSES,
  HAS_VOTING_POWER_VERIFIER_ADDRESSES,
  HAS_VOTED_VERIFIER_ADDRESSES,
  OWNS_CITIZEN_VERIFIER_ADDRESSES,
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
  const verifierAddress = OWNS_CITIZEN_VERIFIER_ADDRESSES[
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
    const [xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = OWNS_CITIZEN_VERIFIER_ADDRESSES[
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
