import { IPFS_GATEWAY } from 'const/config'

export function getIPFSGateway(ipfsString: string) {
  if (!ipfsString) return ''

  // Return local paths and blob URLs as-is
  if (ipfsString.startsWith('/') || ipfsString.startsWith('blob:')) {
    return ipfsString
  }

  // Return full URLs as-is (already have protocol)
  if (ipfsString.startsWith('http://') || ipfsString.startsWith('https://')) {
    // Check if it's already an IPFS gateway URL
    if (ipfsString.includes('/ipfs/')) {
      return ipfsString
    }
    // Otherwise return as-is (could be any external URL)
    return ipfsString
  }

  // Process IPFS hashes
  let hash = ipfsString.startsWith('ipfs://') ? ipfsString.split('ipfs://')[1] : ipfsString
  return `${IPFS_GATEWAY}${hash}`
}

const IPFS_GATEWAYS = [
  IPFS_GATEWAY,
  'https://cf-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
]

export async function fetchFromIPFSWithFallback(ipfsHash: string, timeout = 3000): Promise<any> {
  // Normalize hash - remove ipfs:// prefix if present
  const hash = ipfsHash.startsWith('ipfs://') ? ipfsHash.replace('ipfs://', '') : ipfsHash

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await Promise.race([
        fetch(`${gateway}${hash}`),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('IPFS fetch timeout')), timeout)
        ),
      ])

      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.warn(`Failed to fetch from gateway ${gateway}:`, error)
      continue // Try next gateway
    }
  }

  // All gateways failed
  throw new Error(`All IPFS gateways failed for hash: ${hash}`)
}
