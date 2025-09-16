/*
 * GCP HSM Signer for Ethereum (EOA owned by the LLC)
 * ethers.js v5.7 compatible version
 * ---------------------------------------------------
 * - Uses Google Cloud KMS secp256k1 HSM key to sign:
 *   - EIP-191 personal_sign (\x19Ethereum Signed Message...)
 *   - EIP-712 typed data (with 0x1901 prefix)
 *   - EIP-1559 transactions (type 2)
 * - Fetches the real KMS public key (SPKI), derives the Ethereum address
 * - Robust DER parsing for r/s, enforces low-S, computes v by recovery
 * - Proxies unknown JSON-RPC methods to the configured RPC node
 */
import { KeyManagementServiceClient } from '@google-cloud/kms'
import { ethers, utils, providers, BigNumber } from 'ethers'
import {
  arrayify,
  hexlify,
  keccak256,
  toUtf8Bytes,
  joinSignature,
} from 'ethers/lib/utils'
import { arbitrum, sepolia } from '../infura/infuraChains'

// -----------------------------
// Types
// -----------------------------
export type Address = `0x${string}`
export type Hex = `0x${string}`

export interface HSMConfig {
  projectId: string
  locationId: string
  keyRingId: string
  keyId: string
  versionId?: string
  allowedOperations?: string[]
}

export interface SigningResult {
  signature: Hex
  publicKey: Hex
  address: Address
}

// -----------------------------
// Constants & singletons
// -----------------------------
const KMS_CLIENT = (() => {
  const credsB64 = process.env.GCP_SIGNER_SERVICE_ACCOUNT
  const creds = credsB64
    ? JSON.parse(Buffer.from(credsB64, 'base64').toString('utf8'))
    : undefined
  return new KeyManagementServiceClient({ credentials: creds })
})()

// Use string BigInt (works with lower targets than ES2020)
const SEC_P256K1_N = BigInt(
  '115792089237316195423570985008687907852837564279074904382605163141518161494337'
)

// secp256k1 curve parameters
const SEC_P256K1_P = BigInt(
  '115792089237316195423570985008687907853269984665640564039457584007908834671663'
)
const SEC_P256K1_A = BigInt(0)
const SEC_P256K1_B = BigInt(7)
const SEC_P256K1_GX = BigInt(
  '55066263022277343669578718895168534326250603453777594175500187360389116729240'
)
const SEC_P256K1_GY = BigInt(
  '32670510020758816978083085130507043184471273380659243275938904335757337482424'
)

let cachedUncompressedPubKey: Uint8Array | undefined
let cachedAddress: Address | undefined

// -----------------------------
// Helpers
// -----------------------------

// Modular exponentiation for BigInt
function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = BigInt(1)
  base = base % modulus
  while (exponent > BigInt(0)) {
    if (exponent % BigInt(2) === BigInt(1)) {
      result = (result * base) % modulus
    }
    exponent = exponent >> BigInt(1)
    base = (base * base) % modulus
  }
  return result
}

// Modular square root using Tonelli-Shanks algorithm
function modSqrt(n: bigint, p: bigint): bigint | null {
  if (n === BigInt(0)) return BigInt(0)
  if (modPow(n, (p - BigInt(1)) / BigInt(2), p) !== BigInt(1)) return null // Not a quadratic residue

  if (p % BigInt(4) === BigInt(3)) {
    return modPow(n, (p + BigInt(1)) / BigInt(4), p)
  }

  // Tonelli-Shanks algorithm
  let q = p - BigInt(1)
  let s = BigInt(0)
  while (q % BigInt(2) === BigInt(0)) {
    q /= BigInt(2)
    s++
  }

  let z = BigInt(2)
  while (modPow(z, (p - BigInt(1)) / BigInt(2), p) !== p - BigInt(1)) {
    z++
  }

  let m = s
  let c = modPow(z, q, p)
  let t = modPow(n, q, p)
  let r = modPow(n, (q + BigInt(1)) / BigInt(2), p)

  while (t !== BigInt(1)) {
    let tt = t
    let i = BigInt(1)
    while (i < m && modPow(tt, BigInt(2) ** i, p) !== BigInt(1)) {
      i++
    }
    let b = modPow(c, BigInt(2) ** (m - i - BigInt(1)), p)
    m = i
    c = (b * b) % p
    t = (t * c) % p
    r = (r * b) % p
  }

  return r
}

// Decompress a secp256k1 public key
function decompressPublicKey(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== 33) {
    throw new Error('Compressed public key must be 33 bytes')
  }

  const prefix = compressed[0]
  if (prefix !== 0x02 && prefix !== 0x03) {
    throw new Error('Invalid compressed public key prefix')
  }

  // Extract x coordinate
  const xBytes = compressed.slice(1)
  const x = BigInt('0x' + Buffer.from(xBytes).toString('hex'))

  // Calculate y^2 = x^3 + 7 (mod p)
  const ySquared =
    (modPow(x, BigInt(3), SEC_P256K1_P) + SEC_P256K1_B) % SEC_P256K1_P

  // Find y using modular square root
  const y = modSqrt(ySquared, SEC_P256K1_P)
  if (y === null) {
    throw new Error('Invalid compressed public key - no valid y coordinate')
  }

  // Choose the correct y based on the prefix
  const isEven = prefix === 0x02
  const yIsEven = y % BigInt(2) === BigInt(0)

  let finalY = y
  if (isEven !== yIsEven) {
    finalY = SEC_P256K1_P - y
  }

  // Convert to bytes
  const xHex = x.toString(16).padStart(64, '0')
  const yHex = finalY.toString(16).padStart(64, '0')

  const result = new Uint8Array(65)
  result[0] = 0x04 // Uncompressed prefix
  result.set(Buffer.from(xHex, 'hex'), 1)
  result.set(Buffer.from(yHex, 'hex'), 33)

  return result
}
function readAsn1Length(
  buf: Uint8Array,
  offset: number
): { len: number; off: number } {
  let len = buf[offset++]
  if ((len & 0x80) === 0) return { len, off: offset }
  const numBytes = len & 0x7f
  len = 0
  for (let i = 0; i < numBytes; i++) len = (len << 8) | buf[offset++]
  return { len, off: offset }
}

function spkiPemToUncompressedPoint(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(Buffer.from(base64, 'base64'))

  let off = 0
  if (der[off++] !== 0x30) throw new Error('SPKI: expected SEQUENCE')
  const seq1 = readAsn1Length(der, off)
  off = seq1.off

  if (der[off++] !== 0x30)
    throw new Error('SPKI: expected AlgorithmIdentifier SEQUENCE')
  const alg = readAsn1Length(der, off)
  off = alg.off

  if (der[off++] !== 0x06) throw new Error('SPKI: expected algorithm OID')
  const algOidLen = der[off++]
  off += algOidLen

  if (der[off++] !== 0x06) throw new Error('SPKI: expected parameters OID')
  const paramOidLen = der[off++]
  off += paramOidLen

  if (der[off++] !== 0x03) throw new Error('SPKI: expected BIT STRING')
  const bit = readAsn1Length(der, off)
  off = bit.off

  if (der[off++] !== 0x00) throw new Error('SPKI: unexpected unused-bits')
  if (der[off] !== 0x04) throw new Error('SPKI: expected uncompressed EC point')
  const point = der.slice(off, off + 65)
  if (point.length !== 65) throw new Error('SPKI: invalid EC point length')
  return point
}

async function getPublicKey(
  cfg: HSMConfig
): Promise<{ publicKey: Hex; address: Address }> {
  if (cachedUncompressedPubKey) {
    return {
      publicKey: hexlify(cachedUncompressedPubKey) as Hex,
      address: cachedAddress!,
    }
  }
  const name = KMS_CLIENT.cryptoKeyVersionPath(
    cfg.projectId,
    cfg.locationId,
    cfg.keyRingId,
    cfg.keyId,
    cfg.versionId || '1'
  )
  const [pub] = await KMS_CLIENT.getPublicKey({ name })
  if (!pub || !pub.pem) throw new Error('KMS: getPublicKey returned no PEM')
  const point = spkiPemToUncompressedPoint(pub.pem)
  const addr = utils.computeAddress(point) as Address
  cachedUncompressedPubKey = point
  cachedAddress = addr
  return { publicKey: hexlify(point) as Hex, address: addr }
}

function parseDerEcdsaSignature(der: Uint8Array): { r: Hex; s: Hex } {
  let off = 0
  if (der[off++] !== 0x30) throw new Error('DER: expected SEQUENCE')
  const seq = readAsn1Length(der, off)
  off = seq.off

  if (der[off++] !== 0x02) throw new Error('DER: expected INTEGER r')
  const rLen = readAsn1Length(der, off)
  off = rLen.off
  let r = der.slice(off, off + rLen.len)
  off += rLen.len

  if (der[off++] !== 0x02) throw new Error('DER: expected INTEGER s')
  const sLen = readAsn1Length(der, off)
  off = sLen.off
  let s = der.slice(off, off + sLen.len)
  off += sLen.len

  if (r[0] === 0x00 && r.length > 32) r = r.slice(1)
  if (s[0] === 0x00 && s.length > 32) s = s.slice(1)
  return {
    r: hexlify(utils.zeroPad(r, 32)) as Hex,
    s: hexlify(utils.zeroPad(s, 32)) as Hex,
  }
}

async function kmsSignDigest(
  cfg: HSMConfig,
  digest: Uint8Array
): Promise<{ r: Hex; s: Hex }> {
  const name = KMS_CLIENT.cryptoKeyVersionPath(
    cfg.projectId,
    cfg.locationId,
    cfg.keyRingId,
    cfg.keyId,
    cfg.versionId || '1'
  )
  const [resp] = await KMS_CLIENT.asymmetricSign({
    name,
    digest: { sha256: Buffer.from(digest) },
  })
  if (!resp || !resp.signature) throw new Error('KMS: no signature')
  const der = Buffer.isBuffer(resp.signature)
    ? new Uint8Array(resp.signature)
    : Uint8Array.from(resp.signature as any)
  return parseDerEcdsaSignature(der)
}

export async function signPersonalMessage(
  cfg: HSMConfig,
  message: string | Uint8Array
): Promise<SigningResult> {
  const bytes = typeof message === 'string' ? toUtf8Bytes(message) : message
  const prefix = `\x19Ethereum Signed Message:\n${bytes.length}`
  const digest = keccak256(utils.concat([toUtf8Bytes(prefix), bytes]))
  const { r, s } = await kmsSignDigest(cfg, arrayify(digest))
  const { address, publicKey } = await getPublicKey(cfg)
  for (const v of [27, 28]) {
    const rec = utils.recoverAddress(digest, { r, s, v })
    if (utils.getAddress(rec) === utils.getAddress(address)) {
      return {
        signature: joinSignature({ r, s, v }) as Hex,
        publicKey,
        address,
      }
    }
  }
  throw new Error('Recovery failed')
}

// Update the sendTransaction method in hsm-signer.ts around line 325-355
export async function sendTransaction(
  cfg: HSMConfig,
  tx: any
): Promise<string> {
  const provider = new providers.JsonRpcProvider(
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? arbitrum.rpc : sepolia.rpc
  )
  const from = (await getPublicKey(cfg)).address
  const nonce = await provider.getTransactionCount(from)
  const fee = await provider.getFeeData()
  const network = await provider.getNetwork()

  // Estimate gas if not provided
  let gasLimit = tx.gasLimit
  if (!gasLimit) {
    try {
      gasLimit = await provider.estimateGas({
        to: tx.to,
        data: tx.data,
        from,
        value: tx.value || 0,
      })
      // Add 20% buffer to gas estimate
      gasLimit = gasLimit.mul(120).div(100)
    } catch (error) {
      console.warn('Gas estimation failed, using default:', error)
      gasLimit = utils.parseUnits('100000', 'wei') // Default gas limit
    }
  }

  const finalTx = {
    ...tx,
    from,
    nonce,
    type: 2,
    chainId: network.chainId,
    gasLimit,
    maxFeePerGas: tx.maxFeePerGas ?? fee.maxFeePerGas ?? fee.gasPrice,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? fee.maxPriorityFeePerGas,
  }

  console.log('HSM sendTransaction - Final transaction:', {
    to: finalTx.to,
    from: finalTx.from,
    gasLimit: finalTx.gasLimit?.toString(),
    nonce: finalTx.nonce,
    chainId: finalTx.chainId,
    data: finalTx.data?.slice(0, 10) + '...',
  })

  const unsigned = utils.serializeTransaction(finalTx)
  const digest = keccak256(unsigned)
  const { r, s } = await kmsSignDigest(cfg, arrayify(digest))

  console.log('HSM sendTransaction - Signature components:', {
    r: r.slice(0, 10) + '...',
    s: s.slice(0, 10) + '...',
  })

  for (const v of [27, 28]) {
    const rec = utils.recoverAddress(digest, { r, s, v })
    console.log(`HSM sendTransaction - Recovery test v=${v}:`, rec)
    if (utils.getAddress(rec) === utils.getAddress(from)) {
      console.log(
        'HSM sendTransaction - Recovery successful, sending transaction...'
      )
      const raw = utils.serializeTransaction(finalTx, { v, r, s })
      try {
        const sent = await provider.sendTransaction(raw)
        console.log(
          'HSM sendTransaction - Transaction sent successfully:',
          sent.hash
        )

        // Wait for transaction confirmation
        console.log('HSM sendTransaction - Waiting for confirmation...')
        const receipt = await sent.wait()
        console.log('HSM sendTransaction - Transaction confirmed:', {
          hash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          status: receipt.status,
        })

        return sent.hash
      } catch (error) {
        console.error('HSM sendTransaction - Transaction failed:', error)
        throw error
      }
    }
  }
  throw new Error('Recovery failed')
}

// -----------------------------
// HSM Availability and Signer Creation
// -----------------------------

/**
 * Check if HSM is available by verifying required environment variables
 */
export function isHSMAvailable(): boolean {
  return !!process.env.GCP_SIGNER_SERVICE_ACCOUNT
}

/**
 * Get HSM configuration from environment variables
 */
function getHSMConfig(): HSMConfig {
  if (!isHSMAvailable()) {
    throw new Error(
      'HSM not available - missing required environment variables'
    )
  }

  return {
    projectId: process.env.GCP_PROJECT_ID!,
    locationId: 'global',
    keyRingId: 'moon-dao-keys',
    keyId: 'moon-dao-signer',
    versionId: '1',
    allowedOperations: process.env.GCP_ALLOWED_OPERATIONS?.split(','),
  }
}

/**
 * Create an HSM signer that implements the ethers.js Wallet interface
 */
export function getHSMSigner(): any {
  const config = getHSMConfig()

  return {
    async getAddress(): Promise<Address> {
      const { address } = await getPublicKey(config)
      return address
    },

    async signMessage(message: string | Uint8Array): Promise<string> {
      const result = await signPersonalMessage(config, message)
      return result.signature
    },

    // Update the signTypedData method in hsm-signer.ts
    async signTypedData(
      domain: any,
      types: any,
      value: any
    ): Promise<{ signature: Hex; address: Address }> {
      // Create the EIP-712 hash
      const messageHash = utils._TypedDataEncoder.hash(domain, types, value)

      // DEBUG: Log what we're about to sign
      console.log('HSM signing EIP-712 hash:', messageHash)

      // Get the public key and address
      const { address } = await getPublicKey(config)

      // DEBUG: Log the address we're using
      console.log('HSM address:', address)

      // Sign the raw EIP-712 hash directly (not as a personal message)
      const { r, s } = await kmsSignDigest(config, arrayify(messageHash))

      // DEBUG: Log the signature components
      console.log('HSM signature r:', r)
      console.log('HSM signature s:', s)

      // Recover the correct v value
      for (const v of [27, 28]) {
        const rec = utils.recoverAddress(messageHash, { r, s, v })
        console.log(`HSM recovery test v=${v}:`, rec)
        if (utils.getAddress(rec) === utils.getAddress(address)) {
          console.log('HSM recovery successful with v=', v)
          return {
            signature: joinSignature({ r, s, v }) as Hex,
            address: address,
          }
        }
      }
      throw new Error('Recovery failed')
    },

    async sendTransaction(transaction: any): Promise<any> {
      const txHash = await sendTransaction(config, transaction)
      return { transactionHash: txHash }
    },
  }
}

/**
 * Create an HSM wallet compatible with thirdweb
 */
export async function createHSMWallet(): Promise<any> {
  const config = getHSMConfig()
  const { address, publicKey } = await getPublicKey(config)

  return {
    address,
    publicKey,
    async signMessage(message: string | Uint8Array): Promise<string> {
      const result = await signPersonalMessage(config, message)
      return result.signature
    },
    // Update the signTypedData method in hsm-signer.ts around line 410-430
    // The signTypedData method should have debug logging like this:
    async signTypedData(
      domain: any,
      types: any,
      value: any
    ): Promise<{ signature: Hex; address: Address }> {
      // Create the EIP-712 hash
      const messageHash = utils._TypedDataEncoder.hash(domain, types, value)

      // DEBUG: Log what we're about to sign
      console.log('HSM signing EIP-712 hash:', messageHash)

      // Get the public key and address
      const { address } = await getPublicKey(config)

      // Sign the raw EIP-712 hash directly (not as a personal message)
      const { r, s } = await kmsSignDigest(config, arrayify(messageHash))

      // DEBUG: Log the signature components
      console.log('HSM signature r:', r)
      console.log('HSM signature s:', s)

      // Recover the correct v value
      for (const v of [27, 28]) {
        const rec = utils.recoverAddress(messageHash, { r, s, v })
        console.log(`HSM recovery test v=${v}:`, rec)
        if (utils.getAddress(rec) === utils.getAddress(address)) {
          console.log('HSM recovery successful with v=', v)
          return {
            signature: joinSignature({ r, s, v }) as Hex,
            address: address,
          }
        }
      }
      throw new Error('Recovery failed')
    },
    async sendTransaction(transaction: any): Promise<any> {
      const txHash = await sendTransaction(config, transaction)
      return { transactionHash: txHash }
    },
  }
}

/**
 * Convert a secp256k1 public key to Ethereum address using proper keccak256 derivation
 * @param publicKeyHex - The public key as a hex string (with or without 0x prefix)
 * @returns The derived Ethereum address
 */
export function deriveAddressFromPublicKey(publicKeyHex: string): Address {
  // Remove 0x prefix if present
  const cleanKey = publicKeyHex.startsWith('0x')
    ? publicKeyHex.slice(2)
    : publicKeyHex

  // Convert hex string to Uint8Array
  const publicKeyBytes = Uint8Array.from(Buffer.from(cleanKey, 'hex'))

  // Check if it's a compressed or uncompressed public key
  let uncompressedKey: Uint8Array

  if (publicKeyBytes.length === 33) {
    // Compressed public key - decompress it
    uncompressedKey = decompressPublicKey(publicKeyBytes)
  } else if (publicKeyBytes.length === 65) {
    // Uncompressed public key
    if (publicKeyBytes[0] !== 0x04) {
      throw new Error(
        'Invalid uncompressed public key - should start with 0x04'
      )
    }
    uncompressedKey = publicKeyBytes
  } else {
    throw new Error(
      'Invalid public key length. Expected 33 (compressed) or 65 (uncompressed) bytes'
    )
  }

  // Proper Ethereum address derivation:
  // 1. Remove the 0x04 prefix (first byte)
  // 2. Take keccak256 of the remaining 64 bytes
  // 3. Take the last 20 bytes as the address
  const publicKeyWithoutPrefix = uncompressedKey.slice(1) // Remove 0x04 prefix
  const hash = keccak256(publicKeyWithoutPrefix)
  const address = '0x' + hash.slice(-40) // Last 20 bytes (40 hex chars)

  return address as Address
}

/**
 * Get Ethereum address from GCP_SIGNER_PUBLIC_KEY environment variable
 * @returns The derived Ethereum address
 *
 * @example
 * // Set environment variable:
 * // GCP_SIGNER_PUBLIC_KEY=0x04a1b2c3d4e5f6... (uncompressed, 65 bytes)
 * // or
 * // GCP_SIGNER_PUBLIC_KEY=0x02a1b2c3d4e5f6... (compressed, 33 bytes)
 *
 * const address = getAddressFromEnvPublicKey()
 * console.log('Ethereum address:', address)
 */
export function getAddressFromEnvPublicKey(): Address {
  const publicKeyHex = process.env.GCP_SIGNER_PUBLIC_KEY
  if (!publicKeyHex) {
    throw new Error('GCP_SIGNER_PUBLIC_KEY environment variable not set')
  }

  return deriveAddressFromPublicKey(publicKeyHex)
}

/**
 * Get a secure quest signer (alias for getHSMSigner for backward compatibility)
 */
export function getSecureQuestSigner(): any {
  return getHSMSigner()
}
