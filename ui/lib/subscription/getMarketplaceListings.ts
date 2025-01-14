import { Arbitrum, TEST_CHAIN } from '@thirdweb-dev/chains'
import {
  MARKETPLACE_TABLE_ADDRESSES,
  TABLELAND_ENDPOINT,
  TEAM_ADDRESSES,
} from 'const/config'
import { initSDK } from '../thirdweb/thirdweb'

export default async function getMarketplaceListings() {
  const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? Arbitrum : TEST_CHAIN
  const sdk = initSDK(chain)
  const marketplaceTableContract = await sdk.getContract(
    MARKETPLACE_TABLE_ADDRESSES[chain.slug]
  )
  const teamContract = await sdk.getContract(TEAM_ADDRESSES[chain.slug])

  const marketplaceTableName = await marketplaceTableContract.call(
    'getTableName'
  )

  const statement = `SELECT * FROM ${marketplaceTableName}`

  const allListingsRes = await fetch(
    `${TABLELAND_ENDPOINT}?statement=${statement}`
  )
  const allListings = await allListingsRes.json()

  const now = Math.floor(Date.now() / 1000)

  const validListings = allListings.filter(async (listing: any) => {
    const teamExpiration = await teamContract.call('expiresAt', [
      listing.teamId,
    ])
    return teamExpiration.toNumber() > now
  })

  return validListings
}
