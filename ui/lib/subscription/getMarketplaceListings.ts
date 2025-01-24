import { CYPRESS_CHAIN_V5 } from '@/cypress/mock/config'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import TeamABI from 'const/abis/Team.json'
import { MARKETPLACE_TABLE_ADDRESSES, TEAM_ADDRESSES } from 'const/config'
import { getContract, readContract } from 'thirdweb'
import queryTable from '../tableland/queryTable'
import { getChainSlug } from '../thirdweb/chain'
import { serverClient } from '../thirdweb/client'

export default async function getMarketplaceListings() {
  const chain = CYPRESS_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const marketplaceTableContract = getContract({
    client: serverClient,
    address: MARKETPLACE_TABLE_ADDRESSES[chainSlug],
    chain: chain,
    abi: MarketplaceTableABI as any,
  })
  const teamContract = getContract({
    client: serverClient,
    address: TEAM_ADDRESSES[chainSlug],
    chain: chain,
    abi: TeamABI as any,
  })

  const marketplaceTableName = await readContract({
    contract: marketplaceTableContract,
    method: 'getTableName',
  })

  const statement = `SELECT * FROM ${marketplaceTableName}`

  const allListings = await queryTable(chain, statement)

  const now = Math.floor(Date.now() / 1000)

  const validListings = allListings.filter(async (listing: any) => {
    const teamExpiration = await readContract({
      contract: teamContract,
      method: 'expiresAt',
      params: [listing.teamId],
    })
    return +teamExpiration.toString() > now
  })

  return validListings
}
