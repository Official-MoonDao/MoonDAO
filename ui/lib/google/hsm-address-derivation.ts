// hsm-address-derivation.ts
import { KeyManagementServiceClient } from '@google-cloud/kms'
import { config } from 'dotenv'
import { utils } from 'ethers'
import { keccak256 } from 'ethers/lib/utils'

config({ path: ['.env.local', '.env'] })

// Copy the DER parsing functions from hsm-signer.ts
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

async function getPublicKey() {
  // Use the same credentials setup as the HSM signer
  const credsB64 = process.env.GCP_SIGNER_SERVICE_ACCOUNT
  const creds = credsB64
    ? JSON.parse(Buffer.from(credsB64, 'base64').toString('utf8'))
    : undefined

  const client = new KeyManagementServiceClient({ credentials: creds })

  const name = client.cryptoKeyVersionPath(
    process.env.GCP_PROJECT_ID!,
    'global',
    'moon-dao-keys',
    'moon-dao-signer',
    '1'
  )

  const [pub] = await client.getPublicKey({ name })
  console.log('Public key PEM:', pub.pem)

  if (!pub || !pub.pem) throw new Error('KMS: getPublicKey returned no PEM')

  // Use the same function as the HSM signer
  const point = spkiPemToUncompressedPoint(pub.pem)

  console.log(
    'Uncompressed public key (hex):',
    '0x' + Buffer.from(point).toString('hex')
  )

  // Derive address using the same method as our updated function
  const publicKeyWithoutPrefix = point.slice(1) // Remove 0x04 prefix
  const hash = keccak256(publicKeyWithoutPrefix)
  const address = '0x' + hash.slice(-40) // Last 20 bytes

  console.log('Derived Ethereum address:', address)

  // Also test with ethers computeAddress for comparison
  const ethersAddress = utils.computeAddress(point)
  console.log('Ethers computeAddress result:', ethersAddress)
  console.log(
    'Results match:',
    address.toLowerCase() === ethersAddress.toLowerCase()
  )
}

getPublicKey().catch(console.error)
