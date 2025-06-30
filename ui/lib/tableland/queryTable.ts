//server-side function only
import { Database } from '@tableland/sdk'
import { ethers } from 'ethers'
import { Chain } from '@/lib/infura/infuraChains'

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

export default async function queryTable(chain: Chain, statement: string) {
  const provider = new ethers.providers.JsonRpcProvider(chain.rpc)

  const wallet = new ethers.Wallet(process.env.TABLELAND_PRIVATE_KEY as string)
  wallet.connect(provider)

  const signer = createTablelandSigner(wallet, chain.id)

  const db = new Database({
    signer,
  })

  const stmt = db.prepare(statement)
  const result = await stmt.all()
  return result?.results
}
