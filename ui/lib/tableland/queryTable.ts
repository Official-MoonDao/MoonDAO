//server-side function only
import { Database } from '@tableland/sdk'
import { ethers } from 'ethers'
import { ethers5Adapter } from 'thirdweb/adapters/ethers5'
import { serverClient } from '../thirdweb/client'

export default async function queryTable(chain: any, statement: string) {
  const provider = ethers5Adapter.provider.toEthers({
    client: serverClient,
    chain,
  })

  const wallet = new ethers.Wallet(process.env.TABLELAND_PRIVATE_KEY as string)
  wallet.connect(provider)
  const signer = provider.getSigner()

  const db = new Database({
    signer,
  })

  const stmt = db.prepare(statement)
  const result = await stmt.all()
  return result?.results
}
