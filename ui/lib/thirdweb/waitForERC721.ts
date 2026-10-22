import { TEAM_TABLE_NAMES } from 'const/config'
import { teamRowToNFT } from '@/lib/tableland/convertRow'
import { waitForRow } from '@/lib/tableland/waitForRow'
import { getChainSlug } from '@/lib/thirdweb/chain'

const SAFE_TABLE = /^[A-Za-z0-9_]+$/

/**
 * Wait until the team row is indexed. Token metadata is a query against
 * tableland.network, which no longer answers, so the name is read from our table.
 */
export default async function waitForERC721(contract: any, tokenId: string | number) {
  if (!contract) {
    throw new Error('Invalid contract')
  }

  const id = Number(tokenId)
  const tableName = contract.chain ? TEAM_TABLE_NAMES[getChainSlug(contract.chain)] : undefined
  if (!Number.isSafeInteger(id) || id < 0 || !tableName || !SAFE_TABLE.test(tableName)) {
    throw new Error('Failed to fetch NFT')
  }

  const result = await waitForRow({
    statement: `SELECT * FROM ${tableName} WHERE id = ${id} LIMIT 1`,
    checkCondition: (rows) => {
      const name = rows?.[0]?.name
      return typeof name === 'string' && name.trim().length > 0
    },
    pollInterval: 3000,
    timeout: 60000,
    maxRetries: 20,
    cacheBusting: true,
  })

  if (!result.success || !result.data?.[0]) {
    throw new Error('Failed to fetch NFT after 60 seconds')
  }

  return teamRowToNFT(result.data[0])
}
