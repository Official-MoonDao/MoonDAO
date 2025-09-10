import { KeyManagementServiceClient } from '@google-cloud/kms'
import { utils as ethersUtils } from 'ethers'
import { Address, Hex } from 'thirdweb'

/**
 * GCP HSM Signer for MoonDAO
 *
 * This module provides HSM-based signing capabilities using Google Cloud KMS
 * for secure key management. The signer uses the 'moon-dao-signer' key for
 * signing operations.
 */

export interface HSMConfig {
  projectId: string
  locationId: string
  keyRingId: string
  keyId: string
  versionId?: string
  allowedOperations?: string[]
  authToken?: string
}

export interface SigningResult {
  signature: Hex
  publicKey: Hex
  address: Address
}

// Module-level cache for public key and address
let cachedPublicKey: Hex | undefined
let cachedAddress: Address | undefined

/**
 * Validate that the operation is allowed and authenticated
 */
function validateOperation(
  config: HSMConfig,
  operation: string,
  authToken?: string
): void {
  // Check if operation is allowed
  if (
    config.allowedOperations &&
    !config.allowedOperations.includes(operation)
  ) {
    throw new Error(
      `Operation '${operation}' is not allowed for this HSM signer`
    )
  }

  // Check authentication token if required
  if (config.authToken && authToken !== config.authToken) {
    throw new Error('Invalid authentication token for HSM operation')
  }
}

/**
 * Get the public key and address for the HSM key
 */
export async function getPublicKey(
  config: HSMConfig
): Promise<{ publicKey: Hex; address: Address }> {
  if (cachedPublicKey && cachedAddress) {
    return { publicKey: cachedPublicKey, address: cachedAddress }
  }

  try {
    const kms = new KeyManagementServiceClient()
    const keyName = kms.cryptoKeyVersionPath(
      config.projectId,
      config.locationId,
      config.keyRingId,
      config.keyId,
      config.versionId || '1'
    )

    const [publicKeyResponse] = await kms.getPublicKey({ name: keyName })

    if (!publicKeyResponse.pem) {
      throw new Error('Public key not available for the specified key version')
    }

    // Convert PEM-encoded public key to hex
    // Remove PEM headers and decode base64
    const pemContent = publicKeyResponse.pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '')
    const publicKeyBuffer = Buffer.from(pemContent, 'base64')
    const publicKeyHex = `0x${publicKeyBuffer.toString('hex')}` as Hex

    // Extract the uncompressed public key (remove DER header)
    // For ECDSA P-256, the public key is 65 bytes (0x04 + 32 bytes x + 32 bytes y)
    let uncompressedKey = publicKeyHex
    if (
      publicKeyHex.startsWith(
        '0x3059301306072a8648ce3d020106082a8648ce3d03010703420004'
      )
    ) {
      // Remove DER encoding for P-256
      uncompressedKey = `0x04${publicKeyHex.slice(-128)}` as Hex
    } else if (
      publicKeyHex.startsWith(
        '0x3059301306072a8648ce3d020106082a8648ce3d030107034200'
      )
    ) {
      // Remove DER encoding for P-256 (alternative format)
      uncompressedKey = `0x04${publicKeyHex.slice(-128)}` as Hex
    }

    // Derive Ethereum address from public key
    const address = ethersUtils.computeAddress(uncompressedKey) as Address

    // Cache the results
    cachedPublicKey = uncompressedKey
    cachedAddress = address

    return { publicKey: uncompressedKey, address }
  } catch (error) {
    throw new Error(
      `Failed to get public key from HSM: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Sign a message using the HSM key
 */
export async function signMessage(
  config: HSMConfig,
  message: Hex,
  authToken?: string
): Promise<SigningResult> {
  validateOperation(config, 'signMessage', authToken)

  try {
    const kms = new KeyManagementServiceClient()
    const keyName = kms.cryptoKeyVersionPath(
      config.projectId,
      config.locationId,
      config.keyRingId,
      config.keyId,
      config.versionId || '1'
    )

    // Convert hex message to Buffer
    const messageBuffer = Buffer.from(message.slice(2), 'hex')

    // Sign the message
    const [signature] = await kms.asymmetricSign({
      name: keyName,
      digest: {
        sha256: messageBuffer,
      },
    })

    if (!signature || !signature.signature) {
      throw new Error('No signature returned from HSM')
    }

    // Convert signature to hex format
    const signatureBuffer = Buffer.isBuffer(signature.signature)
      ? signature.signature
      : Buffer.from(signature.signature)
    const signatureHex = `0x${signatureBuffer.toString('hex')}` as Hex

    // Get public key and address
    const { publicKey, address } = await getPublicKey(config)

    return {
      signature: signatureHex,
      publicKey,
      address,
    }
  } catch (error) {
    throw new Error(
      `Failed to sign message with HSM: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Sign a transaction hash using the HSM key
 */
export async function signTransactionHash(
  config: HSMConfig,
  txHash: Hex,
  authToken?: string
): Promise<SigningResult> {
  return signMessage(config, txHash, authToken)
}

/**
 * Sign EIP-712 typed data using the HSM key
 */
export async function signTypedData(
  config: HSMConfig,
  domain: any,
  types: any,
  message: any,
  authToken?: string
): Promise<SigningResult> {
  validateOperation(config, 'signTypedData', authToken)

  try {
    // Create the EIP-712 hash
    const domainSeparator = ethersUtils._TypedDataEncoder.hashDomain(domain)
    const structHash = ethersUtils._TypedDataEncoder.from(types).hash(message)
    const digest = ethersUtils.keccak256(
      ethersUtils.defaultAbiCoder.encode(
        ['bytes32', 'bytes32'],
        [domainSeparator, structHash]
      )
    ) as Hex

    return signMessage(config, digest, authToken)
  } catch (error) {
    throw new Error(
      `Failed to sign typed data with HSM: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
  }
}

/**
 * Get the signer address
 */
export async function getAddress(config: HSMConfig): Promise<Address> {
  const { address } = await getPublicKey(config)
  return address
}

/**
 * Create HSM config from environment variables
 */
export function createHSMConfig(): HSMConfig {
  const config: HSMConfig = {
    projectId: process.env.GCP_PROJECT_ID || '',
    locationId: 'global',
    keyRingId: 'moon-dao-keys',
    keyId: 'moon-dao-signer',
    versionId: '1',
    // Security: Only allow specific operations
    allowedOperations: process.env.HSM_ALLOWED_OPERATIONS?.split(',') || [
      'signTypedData',
      'signMessage',
    ],
    // Security: Require authentication token
    authToken: process.env.HSM_AUTH_TOKEN,
  }

  // Validate required environment variables
  if (!config.projectId) {
    throw new Error('GCP_PROJECT_ID environment variable is required')
  }

  if (!config.authToken) {
    throw new Error(
      'HSM_AUTH_TOKEN environment variable is required for security'
    )
  }

  return config
}

/**
 * Singleton instance of the quest config
 */
let hsmConfigInstance: HSMConfig | null = null

/**
 * Get the singleton quest config instance
 */
export function getHSMConfig(): HSMConfig {
  if (!hsmConfigInstance) {
    hsmConfigInstance = createHSMConfig()
  }
  return hsmConfigInstance
}

/**
 * Utility function to check if HSM signing is available
 */
export function isHSMAvailable(): boolean {
  try {
    return !!(
      process.env.GCP_PROJECT_ID &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.HSM_AUTH_TOKEN
    )
  } catch {
    return false
  }
}

/**
 * Sign typed data with authentication (convenience function)
 */
export async function signTypedDataWithAuth(
  domain: any,
  types: any,
  message: any,
  authToken: string
): Promise<SigningResult> {
  const config = getHSMConfig()
  return signTypedData(config, domain, types, message, authToken)
}

/**
 * Sign message with authentication (convenience function)
 */
export async function signMessageWithAuth(
  message: Hex,
  authToken: string
): Promise<SigningResult> {
  const config = getHSMConfig()
  return signMessage(config, message, authToken)
}

/**
 * Get the signer address (convenience function)
 */
export async function getSignerAddress(): Promise<Address> {
  const config = getHSMConfig()
  return getAddress(config)
}

/**
 * Get public key (convenience function)
 */
export async function getSignerPublicKey(): Promise<{
  publicKey: Hex
  address: Address
}> {
  const config = getHSMConfig()
  return getPublicKey(config)
}
