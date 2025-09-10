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
  HAS_JOINED_A_TEAM_VERIFIER_ADDRESSES,
  HAS_CONTRIBUTED_VERIFIER_ADDRESSES,
  HAS_TOKEN_BALANCE_VERIFIER_ADDRESSES,
  HAS_SUBMITTED_PR_VERIFIER_ADDRESSES,
  HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES,
  CITIZEN_REFERRAL_VERIFIER_ADDRESSES,
} from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { NextApiRequest } from 'next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  readContract,
} from 'thirdweb'
import { Address, Hex } from 'thirdweb'
import { privateKeyToAccount as twPrivateKeyToAccount } from 'thirdweb/wallets'
import { getHSMSigner, isHSMAvailable } from '@/lib/google/hsm-signer'
import {
  arbitrum,
  base,
  ethereum,
  polygon,
  sepolia,
} from '@/lib/infura/infuraChains'
import { serverClient } from '@/lib/thirdweb/client'
import { XP_VERIFIERS } from '@/lib/xp/config'
import { signOracleProof } from '../oracle'

function normalizePk(pk?: string): `0x${string}` {
  if (!pk) throw new Error('ORACLE_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

/**
 * Create an account for signing transactions, using HSM if available
 */
async function createSignerAccount(authToken?: string): Promise<any> {
  if (isHSMAvailable()) {
    if (!authToken) {
      throw new Error('Authentication token required for HSM operations')
    }
    const questSigner = getSecureQuestSigner()
    const signerAddress = await questSigner.getAddress()

    // Create a custom account that uses the HSM signer
    return {
      address: signerAddress,
      signMessage: async (message: string) => {
        const result = await questSigner.signMessage(message as Hex, authToken)
        return result.signature
      },
      signTypedData: async (domain: any, types: any, message: any) => {
        const result = await questSigner.signTypedData(
          domain,
          types,
          message,
          authToken
        )
        return result.signature
      },
    }
  } else {
    // Fall back to private key account
    const relayerPk = normalizePk(process.env.XP_ORACLE_SIGNER_PK)
    return twPrivateKeyToAccount({
      client: serverClient,
      privateKey: relayerPk,
    })
  }
}

function getVerifierId(verifierAddress: Address): bigint {
  const verifier = XP_VERIFIERS.find(
    (verifier: any) =>
      verifier.verifierAddress.toLowerCase() === verifierAddress.toLowerCase()
  )
  if (verifier?.verifierId === undefined) {
    throw new Error(`Verifier not found for address: ${verifierAddress}`)
  }
  return BigInt(verifier.verifierId)
}

export function getUserAndAccessToken(req: NextApiRequest) {
  if (req.method === 'GET') {
    const { user, accessToken } = req.query as {
      user?: string
      accessToken?: string
    }
    return { user, accessToken }
  } else {
    const { user, accessToken } = JSON.parse(req.body) as {
      user?: string
      accessToken?: string
    }
    return { user, accessToken }
  }
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
  {
    type: 'function',
    name: 'referralCount',
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
  votingPower: bigint // Changed from minVotingPower to votingPower for clarity
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's voting power
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.votingPower.toString()])
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

  // Context format for staged verifiers: (votingPower, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.votingPower.toString(), // User's voting power
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
  teamsCreated: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's teams created
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.teamsCreated.toString()])
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

  // Context format for staged verifiers: (teamsCreated, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.teamsCreated.toString(), // User's teams created
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
  votes: bigint // Changed from minVotes to votes for clarity
  validitySeconds?: number
  authToken?: string // Required for HSM operations
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's vote count
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.votes.toString()])
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

  // Context format for staged verifiers: (votes, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.votes.toString(), // User's vote count
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
    authToken: params.authToken,
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

/**
 * Sign a proof that a user has a certain token balance
 * @param params User address, actual token balance, and validity period
 * @returns Signed proof result with context
 */
export async function signHasTokenBalanceProof(params: {
  user: Address
  balance: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's token balance
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.balance.toString()])
  ) as Hex

  const verifierAddress = HAS_TOKEN_BALANCE_VERIFIER_ADDRESSES[
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

  // Context format for staged verifiers: (balance, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.balance.toString(), // User's token balance
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

/**
 * Fetch the user's total MOONEY token balance across all supported chains
 * @param user User address
 * @returns Total MOONEY balance across all chains
 */
export async function fetchUserMooneyBalance(user: Address): Promise<bigint> {
  // Import MOONEY addresses for all chains
  const { MOONEY_ADDRESSES } = await import('const/config')

  // Simple ERC20 balanceOf ABI
  const ERC20_ABI = [
    {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const

  // Get contracts for all supported chains
  const ethMooneyContract = getContract({
    client: serverClient,
    chain: ethereum,
    address: MOONEY_ADDRESSES['ethereum'] as Address,
    abi: ERC20_ABI as any,
  })

  const polygonMooneyContract = getContract({
    client: serverClient,
    chain: polygon,
    address: MOONEY_ADDRESSES['polygon'] as Address,
    abi: ERC20_ABI as any,
  })

  const arbMooneyContract = getContract({
    client: serverClient,
    chain: arbitrum,
    address: MOONEY_ADDRESSES['arbitrum'] as Address,
    abi: ERC20_ABI as any,
  })

  const baseMooneyContract = getContract({
    client: serverClient,
    chain: base,
    address: MOONEY_ADDRESSES['base'] as Address,
    abi: ERC20_ABI as any,
  })

  try {
    // Fetch balances from all chains in parallel
    const results = await Promise.allSettled([
      readContract({
        contract: ethMooneyContract,
        method: 'balanceOf',
        params: [user],
      }),
      readContract({
        contract: polygonMooneyContract,
        method: 'balanceOf',
        params: [user],
      }),
      readContract({
        contract: arbMooneyContract,
        method: 'balanceOf',
        params: [user],
      }),
      readContract({
        contract: baseMooneyContract,
        method: 'balanceOf',
        params: [user],
      }),
    ])

    // Sum up all successful balance reads
    const totalBalance = results.reduce((total, result) => {
      if (result.status === 'fulfilled') {
        return total + BigInt(result.value as any)
      }
      return total
    }, BigInt(0))

    return totalBalance
  } catch (error) {
    console.error('Error fetching MOONEY balance:', error)
    return BigInt(0)
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
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierId = getVerifierId(contractAddress)
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [votingPower, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [votingPower])
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
  const account = await createSignerAccount()

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
    const [metricValue, , validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [metricValue])
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
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_VOTING_POWER_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

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
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierId = getVerifierId(contractAddress)
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
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierId = getVerifierId(contractAddress)
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [votes, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [votes])
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
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_VOTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function signHasContributedProof(params: {
  user: Address
  contributions: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's contributions
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.contributions.toString()])
  ) as Hex

  const verifierAddress = HAS_CONTRIBUTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  // For staged verifiers, we use 0 as xpAmount since it will be calculated by the contract
  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount: BigInt(0), // XP amount not used in verification for staged verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for staged verifiers: (contributions, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.contributions.toString(), // User's contributions
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

export async function submitHasContributedBulkClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_CONTRIBUTED_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

/**
 * Submit a claim for citizen profile completion XP
 * @param params User address and context
 * @returns Transaction hash
 */
export async function submitHasCompletedCitizenProfileClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierAddress = HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [profileCompleted, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [profileCompleted])
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
 * Submit a token balance claim for a user (requires oracle-signed proof)
 * @param params User address and context (signed proof)
 * @returns Transaction hash
 */
export async function submitHasTokenBalanceBulkClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const verifierAddress = HAS_TOKEN_BALANCE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)
  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  const transaction = prepareContractCall({
    contract,
    method: 'claimBulkXPFor' as string,
    params: [params.user, verifierId, params.context],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}

/**
 * Sign a proof that a user has completed their citizen profile
 * @param params User address and validity period
 * @returns Signed proof result with context
 */
export async function signHasCompletedCitizenProfileProof(params: {
  user: Address
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For citizen profile completion, we use a simple boolean context (1 for completed)
  const profileCompleted = BigInt(1)
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [profileCompleted.toString()])
  ) as Hex

  const verifierAddress = HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For HasCompletedCitizenProfile, we need to use the actual XP amount (5) that the contract expects
  const xpAmount = BigInt(5) // This should match xpPerClaim in the contract
  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount, // Use the actual XP amount, not 0
    validitySeconds: params.validitySeconds,
  })

  // Context format: (profileCompleted, xpAmount, validAfter, validBefore, signature)
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      profileCompleted.toString(), // 1 indicates profile is completed
      xpAmount.toString(), // Use the actual XP amount (5)
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

/**
 * Submit a bulk claim for citizen profile completion XP
 * @param params User address and context
 * @returns Transaction hash
 */
export async function submitHasCompletedCitizenProfileBulkClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_COMPLETED_CITIZEN_PROFILE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function signHasJoinedTeamProof(params: {
  user: Address
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For team joining, we check if user has joined at least 1 team
  const teamsJoined = BigInt(1)
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [teamsJoined.toString()])
  ) as Hex

  const verifierAddress = HAS_JOINED_A_TEAM_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For single verifiers, we need to use the actual XP amount from the contract
  const xpAmount = await fetchVerifierXp(verifierAddress)

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount, // Use actual XP amount for single verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for single verifiers: (teamsJoined, xpAmount, validAfter, validBefore, signature)
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      teamsJoined.toString(), // User has joined at least 1 team
      xpAmount.toString(), // Use actual XP amount
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

export async function submitHasJoinedTeamClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierAddress = HAS_JOINED_A_TEAM_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  if (!contractAddress) throw new Error('XP Manager address missing for chain')
  if (!verifierId)
    throw new Error(`Verifier ID not found for address: ${verifierAddress}`)

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

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

export async function signHasSubmittedPRProof(params: {
  user: Address
  prCount: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's PR count
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.prCount.toString()])
  ) as Hex

  const verifierAddress = HAS_SUBMITTED_PR_VERIFIER_ADDRESSES[
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

  // Context format for staged verifiers: (prCount, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.prCount.toString(), // User's PR count
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

export async function submitHasSubmittedPRBulkClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_SUBMITTED_PR_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function signHasSubmittedIssueProof(params: {
  user: Address
  issueCount: bigint
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For bulk claims, the context hash is based on the user's issue count
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [params.issueCount.toString()])
  ) as Hex

  const verifierAddress = HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[
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

  // Context format for staged verifiers: (issueCount, xpAmount, validAfter, validBefore, signature)
  // The xpAmount is set to 0 since the staged verifier will calculate it
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      params.issueCount.toString(), // User's issue count
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

export async function signHasSubmittedIssueProofSingle(params: {
  user: Address
  validitySeconds?: number
}): Promise<SignedProofResult> {
  if (
    !XP_ORACLE_NAME ||
    !XP_ORACLE_VERSION ||
    !XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN]
  ) {
    throw new Error('Oracle env not configured')
  }

  // For single claims, we check if user has submitted at least 1 issue
  const issueCount = BigInt(1)
  const contextHash = keccak256(
    defaultAbiCoder.encode(['uint256'], [issueCount.toString()])
  ) as Hex

  const verifierAddress = HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  // For single verifiers, we need to use the actual XP amount from the contract
  const xpAmount = await fetchVerifierXp(verifierAddress)

  const { validAfter, validBefore, signature } = await signOracleProof({
    user: params.user,
    verifier: verifierAddress,
    contextHash,
    xpAmount, // Use actual XP amount for single verifiers
    validitySeconds: params.validitySeconds,
  })

  // Context format for single verifiers: (issueCount, xpAmount, validAfter, validBefore, signature)
  const context = defaultAbiCoder.encode(
    ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      issueCount.toString(), // User has submitted at least 1 issue
      xpAmount.toString(), // Use actual XP amount
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

export async function submitHasSubmittedIssueClaimFor(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const verifierAddress = HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)

  return submitBulkClaimFor({
    user: params.user,
    context: params.context,
    verifierId,
    verifierAddress,
  })
}

export async function submitHasSubmittedIssueClaimForSingle(params: {
  user: Address
  context: Hex
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address

  const verifierAddress = HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  const verifierId = getVerifierId(verifierAddress)
  if (!contractAddress) throw new Error('XP Manager address missing for chain')

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // Pre-validate the oracle proof to avoid on-chain revert
  try {
    const [issueCount, xpAmount, validAfter, validBefore, signature] =
      defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
        params.context
      ) as any

    const oracleAddress = XP_ORACLE_ADDRESSES[XP_ORACLE_CHAIN] as Address
    const verifierAddress = HAS_SUBMITTED_ISSUE_VERIFIER_ADDRESSES[
      XP_ORACLE_CHAIN
    ] as Address
    const contextHash = keccak256(
      defaultAbiCoder.encode(['uint256'], [issueCount])
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
 * Check bulk eligibility for referral verifier (no oracle proof needed)
 */
export async function checkReferralBulkEligibility(params: {
  user: Address
}): Promise<{
  eligible: boolean
  totalXP: bigint
  highestStage: bigint
  alreadyClaimed: boolean
  referralCount: bigint
}> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia

  const verifierAddress = CITIZEN_REFERRAL_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address
  if (!verifierAddress) {
    throw new Error('Referral verifier address not configured')
  }

  const verifierContract = getContract({
    client: serverClient,
    chain: twChain,
    address: verifierAddress,
    abi: STAGED_VERIFIER_ABI as any,
  })

  // For ReferralsStaged, context is not used, so we can pass empty bytes
  const emptyContext = '0x' as Hex

  // Check bulk eligibility
  const [eligible, totalXP, highestStage] = (await readContract({
    contract: verifierContract,
    method: 'isBulkEligible',
    params: [params.user, emptyContext],
  })) as [boolean, bigint, bigint]

  // Get referral count directly from the contract
  const referralCount = (await readContract({
    contract: verifierContract,
    method: 'referralCount',
    params: [params.user],
  })) as bigint

  // Check if already claimed using bulk claim ID
  const bulkClaimId = (await readContract({
    contract: verifierContract,
    method: 'bulkClaimId',
    params: [params.user, emptyContext],
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
    referralCount,
  }
}

/**
 * Submit bulk claim for referral verifier (no oracle proof needed)
 */
export async function submitReferralBulkClaimFor(params: {
  user: Address
}): Promise<{ txHash: Hex }> {
  const twChain =
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum : sepolia
  const account = await createSignerAccount()

  const contractAddress = XP_MANAGER_ADDRESSES[XP_ORACLE_CHAIN] as Address
  const verifierAddress = CITIZEN_REFERRAL_VERIFIER_ADDRESSES[
    XP_ORACLE_CHAIN
  ] as Address

  if (!contractAddress) throw new Error('XP Manager address missing for chain')
  if (!verifierAddress)
    throw new Error('Referral verifier address not configured')

  const verifierId = getVerifierId(verifierAddress)

  const contract = getContract({
    client: serverClient,
    chain: twChain,
    address: contractAddress,
    abi: XP_MANAGER_ABI as any,
  })

  // For ReferralsStaged, context is not used, so we can pass empty bytes
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
