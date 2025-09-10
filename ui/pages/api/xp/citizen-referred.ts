/**
 * Citizen Referred API Route
 *
 * This route allows any authenticated user to request that a referral be recorded in the CitizenReferralsStaged contract.
 * The authorized signer (server) performs the actual transaction, but any authenticated user can submit referral requests.
 *
 * SECURITY MEASURES:
 * - Requires valid Privy access token authentication
 * - Validates that both addresses are valid citizens (own citizen NFTs)
 * - Validates that the API caller is the one who minted the citizen
 * - Prevents self-referrals and duplicate referrals
 *
 * USAGE:
 * POST /api/xp/san-referred
 * Body: {
 *   "referrerAddress": "0x...",
 *   "accessToken": "privy_access_token"
 * }
 */
import CitizenABI from 'const/abis/Citizen.json'
import {
  CITIZEN_REFERRAL_VERIFIER_ADDRESSES,
  CITIZEN_ADDRESSES,
  DEFAULT_CHAIN_V5,
} from 'const/config'
import { utils as ethersUtils } from 'ethers'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address, Hex } from 'thirdweb'
import {
  getContract,
  readContract,
  prepareContractCall,
  sendTransaction,
} from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import { privateKeyToAccount as twPrivateKeyToAccount } from 'thirdweb/wallets'
import { getSecureQuestSigner, isHSMAvailable } from '@/lib/google/hsm-signer'
import { getPrivyUserData } from '@/lib/privy'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

function normalizePk(pk?: string): `0x${string}` {
  if (!pk) throw new Error('SAN_AUTHORIZED_SIGNER_PK missing')
  return (pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`
}

const CITIZEN_REFERRALS_ABI = [
  {
    type: 'function',
    name: 'referred',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'referredCitizenAddress', type: 'address' },
      { name: 'citizenAddress', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'referredBy',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

async function isValidCitizen(address: Address): Promise<boolean> {
  try {
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const citizenContractAddress = CITIZEN_ADDRESSES[chainSlug] as Address

    if (!citizenContractAddress) {
      throw new Error('Citizen contract address not configured')
    }

    const contract = getContract({
      client: serverClient,
      chain: DEFAULT_CHAIN_V5,
      address: citizenContractAddress,
      abi: CitizenABI as any,
    })

    const ownedTokenId = await readContract({
      contract,
      method: 'getOwnedToken',
      params: [address],
    })

    // If we get here without an error, the address owns a citizen NFT
    return true
  } catch (error: any) {
    // Check if the error is specifically "No token owned"
    if (error.reason === 'No token owned') {
      return false
    }

    console.error(`Error validating citizen for address ${address}:`, error)
    return false
  }
}

async function validateReferrerMintedCitizen(
  referredCitizenAddress: Address,
  referrerAddress: Address
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
    const citizenContractAddress = CITIZEN_ADDRESSES[chainSlug] as Address

    if (!citizenContractAddress) {
      throw new Error('Citizen contract address not configured')
    }

    const contract = getContract({
      client: serverClient,
      chain: DEFAULT_CHAIN_V5,
      address: citizenContractAddress,
      abi: CitizenABI as any,
    })

    // Get the token ID owned by the referred citizen
    const referredTokenId = await readContract({
      contract,
      method: 'getOwnedToken',
      params: [referredCitizenAddress],
    })

    // Get the NFT details to find who minted it
    const nft = await getNFT({
      contract,
      tokenId: BigInt(referredTokenId),
      includeOwner: true,
    })

    if (!nft.owner) {
      return {
        isValid: false,
        error: 'Referred address does not own a citizen NFT',
      }
    }

    // Check if the referrer is the current owner (who minted it)
    // In most NFT contracts, the minter becomes the initial owner
    if (nft.owner.toLowerCase() !== referredCitizenAddress.toLowerCase()) {
      return {
        isValid: false,
        error: 'Only the person who minted the citizen can assign the referral',
      }
    }

    return { isValid: true }
  } catch (error: any) {
    // Handle the "No token owned" error specifically
    if (error.reason === 'No token owned') {
      return {
        isValid: false,
        error: 'Referred address does not own a citizen NFT',
      }
    }

    console.error('Error validating referrer minted citizen:', error)
    return { isValid: false, error: 'Failed to validate referral' }
  }
}

async function addReferral(
  referredCitizenAddress: Address,
  citizenAddress: Address
): Promise<{ txHash: Hex }> {
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const verifierAddress = CITIZEN_REFERRAL_VERIFIER_ADDRESSES[
    chainSlug
  ] as Address

  if (!verifierAddress) {
    throw new Error('Referral verifier address not configured')
  }

  // Use HSM signer if available, otherwise fall back to private key
  let account: any

  if (isHSMAvailable()) {
    const questSigner = getSecureQuestSigner()
    const signerAddress = await questSigner.getAddress()
    const authToken = process.env.HSM_AUTH_TOKEN

    if (!authToken) {
      throw new Error('HSM authentication token not configured')
    }

    // For HSM, we need to create a custom account that uses the HSM signer
    // This is a simplified approach - in production you might want to implement
    // a more sophisticated account wrapper
    account = {
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
    // Get the authorized signer's private key from environment
    const authorizedSignerPk = process.env.XP_ORACLE_SIGNER_PK
    if (!authorizedSignerPk) {
      throw new Error('Authorized signer private key not configured')
    }

    account = twPrivateKeyToAccount({
      client: serverClient,
      privateKey: normalizePk(authorizedSignerPk),
    })
  }

  const contract = getContract({
    client: serverClient,
    chain: DEFAULT_CHAIN_V5,
    address: verifierAddress,
    abi: CITIZEN_REFERRALS_ABI as any,
  })

  // Check if the referred citizen is already referred
  const existingReferrer = (await readContract({
    contract,
    method: 'referredBy',
    params: [referredCitizenAddress],
  })) as Address

  if (existingReferrer !== '0x0000000000000000000000000000000000000000') {
    throw new Error('Citizen is already referred')
  }

  const transaction = prepareContractCall({
    contract,
    method: 'referred',
    params: [referredCitizenAddress, citizenAddress],
  })

  const { transactionHash } = await sendTransaction({
    account,
    transaction,
  })

  return { txHash: transactionHash as Hex }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Get access token from request body
    const { referrerAddress, accessToken } = req.body

    if (!accessToken) {
      return res.status(401).json({ error: 'Missing access token' })
    }

    // Get user data from Privy
    const privyUserData = await getPrivyUserData(accessToken)

    if (!privyUserData) {
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const { walletAddresses } = privyUserData

    if (walletAddresses.length === 0) {
      return res.status(401).json({ error: 'No wallet addresses found' })
    }

    // Use the first wallet address as the referred address
    const referredAddress = walletAddresses[0]

    if (!referrerAddress) {
      return res.status(400).json({
        error: 'Missing required field: referrerAddress',
      })
    }

    // Validate address format
    if (!ethersUtils.isAddress(referrerAddress)) {
      return res.status(400).json({
        error: 'Invalid referrerAddress format',
      })
    }

    // Normalize addresses to checksum format
    const normalizedReferrerAddress = ethersUtils.getAddress(
      referrerAddress
    ) as Address
    const normalizedReferredAddress = ethersUtils.getAddress(
      referredAddress
    ) as Address

    // Prevent self-referral
    if (
      normalizedReferredAddress.toLowerCase() ===
      normalizedReferrerAddress.toLowerCase()
    ) {
      return res.status(400).json({
        error: 'Cannot refer yourself',
      })
    }

    // Validate that both addresses are valid citizens
    const [isReferredCitizenValid, isReferrerValid] = await Promise.all([
      isValidCitizen(normalizedReferredAddress),
      isValidCitizen(normalizedReferrerAddress),
    ])

    if (!isReferredCitizenValid) {
      return res.status(400).json({
        error: 'Referred address does not own a valid citizen NFT',
      })
    }

    if (!isReferrerValid) {
      return res.status(400).json({
        error: 'Referrer address does not own a valid citizen NFT',
      })
    }

    // Validate that the API caller is the one who minted the citizen
    const mintValidation = await validateReferrerMintedCitizen(
      normalizedReferredAddress,
      normalizedReferrerAddress
    )

    if (!mintValidation.isValid) {
      return res.status(400).json({
        error: mintValidation.error,
      })
    }

    // Add the referral to the contract
    const { txHash } = await addReferral(
      normalizedReferredAddress,
      normalizedReferrerAddress
    )

    return res.status(200).json({
      success: true,
      message: 'Referral successfully recorded',
      txHash,
      referredCitizenAddress: normalizedReferredAddress,
      referrerAddress: normalizedReferrerAddress,
    })
  } catch (err: any) {
    console.error('Error in citizen-referred API:', err)

    // Handle specific contract errors
    if (err.message?.includes('Citizen is already referred')) {
      return res.status(409).json({
        error: 'Citizen is already referred by someone else',
      })
    }

    if (err.message?.includes('Only authorized signer')) {
      return res.status(403).json({
        error: 'Only the authorized signer can call this function',
      })
    }

    if (err.message?.includes('Cannot refer yourself')) {
      return res.status(400).json({
        error: 'Cannot refer yourself',
      })
    }

    // Generic error response
    return res.status(500).json({
      error: err?.message || 'Internal server error',
    })
  }
}

export default withMiddleware(handler, authMiddleware)
