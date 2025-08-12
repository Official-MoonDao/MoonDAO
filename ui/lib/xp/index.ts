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
import { privateKeyToAccount as twPrivateKeyToAccount } from 'thirdweb/wallets'
import { arbitrum, sepolia } from '@/lib/infura/infuraChains'
import { serverClient } from '@/lib/thirdweb/client'
import { signOracleProof } from '../oracle'

type Address = `0x${string}`
type Hex = `0x${string}`

const XP_VERIFERS = [
  {
    verifierId: 1,
    verifierAddress: OWNS_CITIZEN_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address,
  },
  {
    verifierId: 2,
    verifierAddress: HAS_VOTING_POWER_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address,
  },
  {
    verifierId: 3,
    verifierAddress: HAS_VOTED_VERIFIER_ADDRESSES[XP_ORACLE_CHAIN] as Address,
  },
]

function normalizePk(pk?: string): `0x${string}` {
  if (!pk) throw new Error('ORACLE_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

const { keccak256, defaultAbiCoder } = ethersUtils

export type SignedProofResult = {
  xpAmount: bigint
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

export async function signHasVotingPowerProof(params: {
  user: Address
  minVotingPower: bigint
  xpAmount: bigint
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

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: HAS_VOTING_POWER_VERIFIER_ADDRESSES[XP_ORACLE_CHAIN] as Address,
    contextHash,
    xpAmount: params.xpAmount,
    validitySeconds: params.validitySeconds,
  })

  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.minVotingPower.toString(),
      params.xpAmount.toString(),
      validAfter.toString(),
      validBefore.toString(),
      signature,
    ]
  ) as Hex

  return {
    xpAmount: params.xpAmount,
    validAfter,
    validBefore,
    signature,
    context,
  }
}

export async function signHasVotedProof(params: {
  user: Address
  minVotes: bigint
  xpAmount: bigint
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

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: HAS_VOTED_VERIFIER_ADDRESSES[XP_ORACLE_CHAIN] as Address,
    contextHash,
    xpAmount: params.xpAmount,
    validitySeconds: params.validitySeconds,
  })

  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.minVotes.toString(),
      params.xpAmount.toString(),
      validAfter.toString(),
      validBefore.toString(),
      signature,
    ]
  ) as Hex

  return {
    xpAmount: params.xpAmount,
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
  xpAmount: bigint
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

  // Context for OwnsCitizenNFT is abi.encode(uint256 xpAmount)
  const context = defaultAbiCoder.encode(
    ['uint256'],
    [params.xpAmount.toString()]
  ) as Hex

  const transaction = prepareContractCall({
    contract,
    method: 'claimXPFor' as string,
    params: [params.user, verifierId, context],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}
