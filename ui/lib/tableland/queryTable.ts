//server-side function only
import { Database } from '@tableland/sdk'
import { ethers } from 'ethers'
import { Chain } from '@/lib/rpc/chains'

// Signer adapter for Tableland SDK
function createTablelandSigner(wallet: ethers.Wallet, chainId: number) {
  const signer = {
    ...wallet,
    chainId: chainId,
    getChainId: () => Promise.resolve(chainId),
    provider: {
      ...wallet.provider,
      network: Promise.resolve({ chainId: chainId }),
      getNetwork: () => Promise.resolve({ chainId: chainId }),
    },
    getNetwork: () => Promise.resolve({ chainId: chainId }),
  } as any

  return signer
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default async function queryTable(
  chain: Chain,
  statement: string,
  retries = 3,
  delay = 1000
): Promise<any> {
  const provider = new ethers.providers.JsonRpcProvider(chain.rpc)

  const wallet = new ethers.Wallet(process.env.TABLELAND_PRIVATE_KEY as string)
  wallet.connect(provider)

  const signer = createTablelandSigner(wallet, chain.id)

  const db = new Database({
    signer,
  })

  const stmt = db.prepare(statement)

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await stmt.all()
      return result?.results
    } catch (error: any) {
      const isRateLimit =
        error?.message?.includes('Too Many Requests') ||
        error?.status === 429 ||
        error?.cause?.status === 429

      if (isRateLimit && attempt < retries - 1) {
        const backoffDelay = delay * Math.pow(2, attempt)
        console.warn(
          `Tableland rate limit hit, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${retries})`
        )
        await sleep(backoffDelay)
        continue
      }

      // If not rate limit or out of retries, throw
      throw error
    }
  }

  // This should never be reached, but TypeScript needs it
  return null
}
