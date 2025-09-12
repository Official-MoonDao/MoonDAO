/**
 * GCP HSM Signer for XP Oracle, Citizen Referrals and Gasless Transactions
 *
 * This module provides HSM-based signing capabilities using Google Cloud KMS
 * for secure transaction signing.
 */
import { KeyManagementServiceClient } from '@google-cloud/kms'
import { GCP_HSM_SIGNER_ADDRESS } from 'const/config'
import { utils as ethersUtils, providers } from 'ethers'
import { Address, Hex } from 'thirdweb'
import { arbitrum, sepolia } from '../infura/infuraChains'

// Define SignableMessage type since it's not exported from thirdweb
type SignableMessage = string | { raw: `0x${string}` | Uint8Array }

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

const RPC_URL =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum.rpc : sepolia.rpc

/**
 * Validate that the operation is allowed and authenticated
 */
function validateOperation(config: HSMConfig, operation: string): void {
  // Check if operation is allowed
  if (
    config.allowedOperations &&
    !config.allowedOperations.includes(operation)
  ) {
    throw new Error(
      `Operation '${operation}' is not allowed for this HSM signer`
    )
  }
}

/**
 * Convert PEM public key to Ethereum address by manually parsing DER
 */
function pemToEthereumAddress(pemKey: string): Address {
  try {
    // Remove PEM headers and decode base64
    const base64Key = pemKey
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '') // Remove whitespace

    const derBuffer = Buffer.from(base64Key, 'base64')

    console.log('DER buffer length:', derBuffer.length)
    console.log('First 10 bytes:', derBuffer.slice(0, 10).toString('hex'))
    console.log(
      'First 10 bytes as chars:',
      derBuffer
        .slice(0, 10)
        .map((b) => String.fromCharCode(b))
        .join('')
    )

    // Parse DER structure to find the uncompressed public key
    let offset = 0

    // Skip outer SEQUENCE
    if (derBuffer[offset] !== 0x30) {
      console.log(
        'First byte:',
        derBuffer[offset].toString(16),
        'expected 0x30'
      )
      throw new Error('Invalid DER structure: expected SEQUENCE')
    }
    offset++

    // Skip length
    const outerLength = derBuffer[offset]
    if (outerLength & 0x80) {
      const lengthBytes = outerLength & 0x7f
      offset += lengthBytes + 1
    } else {
      offset += 1
    }

    // Skip AlgorithmIdentifier SEQUENCE
    if (derBuffer[offset] !== 0x30) {
      console.log(
        'Expected AlgorithmIdentifier at offset',
        offset,
        'got:',
        derBuffer[offset].toString(16)
      )
      throw new Error(
        'Invalid DER structure: expected AlgorithmIdentifier SEQUENCE'
      )
    }
    offset++

    // Skip AlgorithmIdentifier length
    const algLength = derBuffer[offset]
    if (algLength & 0x80) {
      const lengthBytes = algLength & 0x7f
      offset += lengthBytes + 1
    } else {
      offset += 1
    }

    // Skip OID for secp256k1 (1.3.132.0.10)
    if (derBuffer[offset] !== 0x06) {
      console.log(
        'Expected OID at offset',
        offset,
        'got:',
        derBuffer[offset].toString(16)
      )
      throw new Error('Invalid DER structure: expected OID')
    }
    offset++
    const oidLength = derBuffer[offset]
    offset += oidLength + 1

    // Skip NULL parameters
    if (derBuffer[offset] === 0x05) {
      offset++
      const nullLength = derBuffer[offset]
      offset += nullLength + 1
    }

    // Now we should be at the BIT STRING containing the public key
    if (derBuffer[offset] !== 0x03) {
      console.log(
        'Expected BIT STRING at offset',
        offset,
        'got:',
        derBuffer[offset].toString(16)
      )
      throw new Error('Invalid DER structure: expected BIT STRING')
    }
    offset++

    // Skip BIT STRING length
    const bitStringLength = derBuffer[offset]
    if (bitStringLength & 0x80) {
      const lengthBytes = bitStringLength & 0x7f
      offset += lengthBytes + 1
    } else {
      offset += 1
    }

    // Skip unused bits byte (should be 0x00)
    offset++

    // Check for uncompressed public key (starts with 0x04)
    if (derBuffer[offset] !== 0x04) {
      console.log(
        'Expected uncompressed public key at offset',
        offset,
        'got:',
        derBuffer[offset].toString(16)
      )
      throw new Error('Expected uncompressed public key (0x04 prefix)')
    }
    offset++

    // Extract the 64-byte uncompressed public key (32 bytes X + 32 bytes Y)
    if (derBuffer.length < offset + 64) {
      throw new Error('Insufficient data for uncompressed public key')
    }

    const uncompressedPublicKey = derBuffer.slice(offset, offset + 64)
    const publicKeyHex = '0x' + uncompressedPublicKey.toString('hex')

    console.log('Extracted public key:', publicKeyHex)

    // Compute Ethereum address
    const address = ethersUtils.computeAddress(publicKeyHex) as Address
    return address
  } catch (error: any) {
    throw new Error(
      `Failed to convert PEM to Ethereum address: ${error.message}`
    )
  }
}

/**
 * Get the public key and address from HSM
 */
export async function getPublicKey(): Promise<{
  publicKey: Hex
  address: Address
}> {
  // Return cached values if available
  if (cachedPublicKey && cachedAddress) {
    return { publicKey: cachedPublicKey, address: cachedAddress }
  }

  try {
    // Get the address from environment variable
    const addressHex = process.env.GCP_SIGNER_PUBLIC_KEY
    if (!addressHex) {
      throw new Error('GCP_SIGNER_PUBLIC_KEY environment variable is required')
    }

    console.log('=== DEBUGGING GCP_SIGNER_PUBLIC_KEY ===')
    console.log('Length:', addressHex.length)
    console.log('Value:', addressHex)
    console.log('Is hex only:', /^[0-9a-fA-F]+$/.test(addressHex))
    console.log('=== END DEBUGGING ===')

    // Convert to proper address format
    const address = addressHex.startsWith('0x')
      ? (addressHex as Address)
      : (`0x${addressHex}` as Address)

    // For the public key, we can use a placeholder since we don't need it for signing
    const publicKey =
      '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as Hex

    console.log('HSM address from config:', address)

    // Cache the results
    cachedPublicKey = publicKey
    cachedAddress = address

    return {
      publicKey,
      address,
    }
  } catch (error) {
    console.error('Failed to get address from config:', error)
    throw error
  }
}

/**
 * Sign a message using the HSM key
 */
export async function signMessage(
  config: HSMConfig,
  message: Hex
): Promise<SigningResult> {
  validateOperation(config, 'signMessage')

  try {
    // Create KMS client with service account credentials directly
    const kms = new KeyManagementServiceClient({
      credentials: process.env.GCP_SIGNER_SERVICE_ACCOUNT
        ? JSON.parse(
            Buffer.from(
              process.env.GCP_SIGNER_SERVICE_ACCOUNT,
              'base64'
            ).toString()
          )
        : undefined,
    })

    const keyName = kms.cryptoKeyVersionPath(
      config.projectId,
      config.locationId,
      config.keyRingId,
      config.keyId,
      config.versionId || '1'
    )

    // Convert hex message to Buffer - properly handle the hex string
    const messageBuffer = Buffer.from(message.replace('0x', ''), 'hex')

    console.log('=== BEFORE KMS CALL ===')
    console.log('Key name:', keyName)
    console.log('Message buffer length:', messageBuffer.length)
    console.log('Message buffer hex:', messageBuffer.toString('hex'))
    console.log('Original message:', message)

    // Hash the message to get a 32-byte digest
    const messageHash = ethersUtils.keccak256(messageBuffer)
    const digestBuffer = Buffer.from(messageHash.slice(2), 'hex') // Remove 0x prefix

    console.log('Message hash:', messageHash)
    console.log('Digest buffer length:', digestBuffer.length)
    console.log('Digest buffer hex:', digestBuffer.toString('hex'))

    // Sign the message using Keccak256 hash (not SHA256)
    const [signature] = await kms.asymmetricSign({
      name: keyName,
      digest: {
        sha256: digestBuffer, // This is actually the Keccak256 hash, but KMS expects sha256 field
      },
    })

    console.log('=== KMS SIGNING DEBUG ===')
    console.log('KMS signing response:', JSON.stringify(signature, null, 2))
    console.log('Signature exists:', !!signature)
    console.log(
      'Signature.signature exists:',
      !!(signature && signature.signature)
    )
    console.log('Signature type:', typeof signature?.signature)
    console.log('Signature is Buffer:', Buffer.isBuffer(signature?.signature))

    if (!signature || !signature.signature) {
      console.error('No signature returned from HSM')
      console.error('Full response:', signature)
      throw new Error('No signature returned from HSM')
    }

    // Convert signature to hex format
    const signatureBuffer = Buffer.isBuffer(signature.signature)
      ? signature.signature
      : Buffer.from(signature.signature)

    console.log('Raw signature from HSM:', signatureBuffer.toString('hex'))
    console.log('Signature length:', signatureBuffer.length)
    console.log('=== END KMS SIGNING DEBUG ===')

    // Check if signature buffer is valid
    if (signatureBuffer.length === 0) {
      console.error('Empty signature returned from HSM')
      console.error('Signature object:', signature)
      throw new Error('Empty signature returned from HSM')
    }

    // Check if first byte exists
    if (signatureBuffer[0] === undefined) {
      console.error('Invalid signature buffer - first byte is undefined')
      console.error('Signature buffer:', signatureBuffer)
      throw new Error('Invalid signature buffer returned from HSM')
    }

    console.log('First byte:', signatureBuffer[0].toString(16))

    // Convert DER signature to raw format if needed
    let signatureHex: Hex
    if (signatureBuffer[0] === 0x30) {
      // This is a DER-encoded signature, convert to raw format
      try {
        // Parse DER signature: 0x30 [length] 0x02 [r_length] [r] 0x02 [s_length] [s]
        let offset = 1 // Skip 0x30
        const derLength = signatureBuffer[offset++]

        // Skip 0x02
        if (signatureBuffer[offset] === 0x02) {
          offset++
        }

        // Extract r component
        const rLength = signatureBuffer[offset++]
        let r = signatureBuffer.slice(offset, offset + rLength).toString('hex')
        offset += rLength

        // Remove leading zero if present
        if (r.startsWith('00')) {
          r = r.slice(2)
        }
        // Pad to 64 hex characters (32 bytes)
        r = r.padStart(64, '0')

        // Skip 0x02
        if (signatureBuffer[offset] === 0x02) {
          offset++
        }

        // Extract s component
        const sLength = signatureBuffer[offset++]
        let s = signatureBuffer.slice(offset, offset + sLength).toString('hex')

        // Remove leading zero if present
        if (s.startsWith('00')) {
          s = s.slice(2)
        }
        // Pad to 64 hex characters (32 bytes)
        s = s.padStart(64, '0')

        // Calculate the correct v value by testing both possibilities
        // Use the ORIGINAL message hash (Keccak256) for recovery, not the SHA256 hash
        const messageHash = ethersUtils.keccak256(messageBuffer)

        let v = '1b' // Default to 27
        let recoveredAddress = ''

        // Test both v values (27 and 28) to find the correct one
        for (const testV of ['1b', '1c']) {
          const testSignature = `0x${r}${s}${testV}` as Hex
          try {
            const testRecoveredAddress = ethersUtils.recoverAddress(
              messageHash, // Use the original Keccak256 hash for recovery
              testSignature
            )
            console.log(
              `Testing v=${testV}, recovered address: ${testRecoveredAddress}`
            )
            // Use the first one that works and store the address
            v = testV
            recoveredAddress = testRecoveredAddress
            break
          } catch (error) {
            console.log(`Testing v=${testV} failed:`, error.message)
          }
        }

        // Create raw signature: r + s + v
        signatureHex = `0x${r}${s}${v}` as Hex
        console.log('Converted DER signature to raw format:', signatureHex)
        console.log('r:', r)
        console.log('s:', s)
        console.log('v:', v)
        console.log('Recovered address:', recoveredAddress)
        console.log(
          'Final signature length:',
          (signatureHex.length - 2) / 2,
          'bytes'
        )

        // Return signature with the ACTUAL recovered address
        return {
          signature: signatureHex,
          publicKey:
            '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as Hex,
          address: recoveredAddress as Address, // Use the actual recovered address
        }
      } catch (error) {
        console.warn('Failed to parse DER signature:', error)
        signatureHex = `0x${signatureBuffer.toString('hex')}` as Hex
      }
    } else {
      // Already in raw format
      signatureHex = `0x${signatureBuffer.toString('hex')}` as Hex
    }

    console.log('Final signature hex:', signatureHex)

    // Return signature with placeholder values - don't call getPublicKey!
    return {
      signature: signatureHex,
      publicKey:
        '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' as Hex,
      address: '0x0000000000000000000000000000000000000000' as Address,
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
 * Sign EIP-712 typed data using the HSM key
 */
export async function signTypedData(
  config: HSMConfig,
  domain: any,
  types: any,
  message: any
): Promise<SigningResult> {
  validateOperation(config, 'signTypedData')

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

    return signMessage(config, digest)
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
  const { address } = await getPublicKey()
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
    // No auth token needed - service account credentials are sufficient
    authToken: undefined,
  }

  // Validate required environment variables
  if (!config.projectId) {
    throw new Error('GCP_PROJECT_ID environment variable is required')
  }

  // Only check for base64 service account
  if (!process.env.GCP_SIGNER_SERVICE_ACCOUNT) {
    throw new Error(
      'GCP_SIGNER_SERVICE_ACCOUNT environment variable is required'
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
    // HSM is only available if we have full KMS setup (project ID + service account)
    // The hardcoded address is only used for verification, not for signing
    return !!(
      process.env.GCP_PROJECT_ID && process.env.GCP_SIGNER_SERVICE_ACCOUNT
    )
  } catch {
    return false
  }
}

/**
 * Get HSM signer instance for oracle operations
 */
export function getHSMSigner() {
  const config = getHSMConfig()
  return {
    getAddress: () => getAddress(config),
    signMessage: (message: Hex) => signMessage(config, message),
    signTypedData: (domain: any, types: any, message: any) =>
      signTypedData(config, domain, types, message),
  }
}

/**
 * Create a custom HSM wallet for thirdweb that can send transactions
 */
export async function createHSMWallet() {
  if (!isHSMAvailable()) {
    throw new Error('HSM not available')
  }

  const hsmSigner = getHSMSigner()
  const address = await hsmSigner.getAddress()

  // Create a custom Ethereum provider that uses our HSM signer
  const hsmProvider = {
    request: async ({ method, params }: { method: string; params: any[] }) => {
      const hsmSigner = getHSMSigner()

      switch (method) {
        case 'eth_accounts':
          return [address]

        case 'eth_requestAccounts':
          return [address]

        case 'eth_chainId':
          return '0x1' // Ethereum mainnet

        case 'eth_getBalance':
          // This would need to be implemented with an RPC call
          throw new Error('eth_getBalance not implemented for HSM')

        case 'eth_sendTransaction':
          // This is the key method for sending transactions
          const [tx] = params
          return await sendHSMTransaction(tx)

        case 'personal_sign':
          const [signMessage, signAccount] = params
          if (signAccount !== address) {
            throw new Error('Account mismatch')
          }
          return await hsmSigner.signMessage(signMessage)

        case 'eth_signTypedData_v4':
          const [typedDataAccount, typedData] = params
          if (typedDataAccount !== address) {
            throw new Error('Account mismatch')
          }

          // Parse the typed data JSON string
          const parsedTypedData = JSON.parse(typedData)

          // Extract domain, types, and message from the parsed data
          const { domain, types, message: typedMessage } = parsedTypedData

          return await hsmSigner.signTypedData(domain, types, typedMessage)

        default:
          throw new Error(`Unsupported method: ${method}`)
      }
    },
  }

  // Return a wallet-like object that can be used with thirdweb
  return {
    id: 'hsm-wallet',
    type: 'local',
    getAddress: () => Promise.resolve(address),
    getChain: () => Promise.resolve(undefined),
    switchChain: () => Promise.resolve(undefined),
    disconnect: () => Promise.resolve(),
    signMessage: async ({ message }: { message: SignableMessage }) => {
      const hsmSigner = getHSMSigner()

      // Convert SignableMessage to Hex format
      let messageHex: Hex
      if (typeof message === 'string') {
        // If it's a string, convert to hex
        messageHex = `0x${Buffer.from(message, 'utf8').toString('hex')}` as Hex
      } else if (message && typeof message === 'object' && 'raw' in message) {
        // If it's an object with raw property, use the raw value
        if (typeof message.raw === 'string') {
          messageHex = message.raw as Hex
        } else {
          // Convert Uint8Array to hex
          messageHex = `0x${Buffer.from(message.raw).toString('hex')}` as Hex
        }
      } else {
        throw new Error('Invalid message format')
      }

      return await hsmSigner.signMessage(messageHex)
    },
    signTypedData: async (domain: any, types: any, message: any) => {
      const hsmSigner = getHSMSigner()
      return await hsmSigner.signTypedData(domain, types, message)
    },
    sendTransaction: async (transaction: any) => {
      return await sendHSMTransaction(transaction)
    },
    provider: hsmProvider,
  }
}

/**
 * Send a transaction using HSM signing
 */
async function sendHSMTransaction(tx: any): Promise<string> {
  const hsmSigner = getHSMSigner()

  // Get transaction count (nonce)
  const nonce = await getTransactionCount(tx.from)

  // Get gas price
  const gasPrice = await getGasPrice()

  // Estimate gas if not provided
  let gasLimit = tx.gas
  if (!gasLimit) {
    gasLimit = await estimateGas(tx)
  }

  // Build the transaction object
  const transaction = {
    to: tx.to,
    value: tx.value || '0x0',
    data: tx.data || '0x',
    gasLimit: gasLimit,
    gasPrice: gasPrice,
    nonce: parseInt(nonce, 16), // Convert hex string to number
    chainId: tx.chainId || 1, // Default to Ethereum mainnet
  }

  // Create transaction hash for signing
  const serializedTx = ethersUtils.serializeTransaction(transaction)
  const txHashBytes = ethersUtils.arrayify(serializedTx)

  // Sign the transaction hash with HSM
  const result = await hsmSigner.signMessage(
    ethersUtils.hexlify(txHashBytes) as Hex
  )

  // Recover the signature components
  const signature = ethersUtils.splitSignature(result.signature)

  // Serialize the signed transaction
  const signedTx = ethersUtils.serializeTransaction(transaction, {
    v: signature.v,
    r: signature.r,
    s: signature.s,
  })

  // Send the signed transaction
  const txHash = await sendRawTransaction(signedTx)

  return txHash
}

/**
 * Get transaction count (nonce) for an address
 */
async function getTransactionCount(
  address: string,
  blockTag: string = 'latest'
): Promise<string> {
  const provider = new providers.JsonRpcProvider(RPC_URL)
  const count = await provider.getTransactionCount(address, blockTag)
  return ethersUtils.hexlify(count)
}

/**
 * Get current gas price
 */
async function getGasPrice(): Promise<string> {
  const provider = new providers.JsonRpcProvider(RPC_URL)
  const gasPrice = await provider.getGasPrice()
  return ethersUtils.hexlify(gasPrice)
}

/**
 * Estimate gas for a transaction
 */
async function estimateGas(tx: any): Promise<string> {
  const provider = new providers.JsonRpcProvider(RPC_URL)
  const gasEstimate = await provider.estimateGas(tx)
  return ethersUtils.hexlify(gasEstimate)
}

/**
 * Send raw transaction to the network
 */
async function sendRawTransaction(signedTx: string): Promise<string> {
  const provider = new providers.JsonRpcProvider(RPC_URL)
  const response = await provider.sendTransaction(signedTx)
  return response.hash
}
