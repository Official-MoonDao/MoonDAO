require('dotenv').config({ path: '.env.local' })

process.env.NEXT_PUBLIC_CHAIN = 'mainnet'

import {
  CITIZEN_TABLE_NAMES,
  PROJECT_TABLE_NAMES,
  DISTRIBUTION_TABLE_NAMES,
  VOTES_TABLE_NAMES,
  TEAM_TABLE_NAMES,
  MISSION_TABLE_NAMES,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
  DEFAULT_CHAIN_V5,
} from '../../ui/const/config'
import * as fs from 'fs'
import { serverClient } from '../../ui/lib/thirdweb/client'
import { getContract, readContract } from 'thirdweb'
import queryTable from '../../ui/lib/tableland/queryTable'
import { getChainSlug } from '../../ui/lib/thirdweb/chain'

async function main() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const tableNames = [
    CITIZEN_TABLE_NAMES,
    PROJECT_TABLE_NAMES,
    DISTRIBUTION_TABLE_NAMES,
    VOTES_TABLE_NAMES,
    TEAM_TABLE_NAMES,
    MISSION_TABLE_NAMES,
  ]
  const allTables = {} as any
  for (let tableNameIndex of tableNames) {
    const tableName = tableNameIndex[chainSlug]
    const statement = `SELECT * FROM ${tableName}`
    const rows = await queryTable(chain, statement)
    allTables[tableName] = rows
  }
  const tables = [JOBS_TABLE_ADDRESSES, MARKETPLACE_TABLE_ADDRESSES]
  for (let table of tables) {
    const tableContract = getContract({
      client: serverClient,
      address: table[chainSlug],
      abi: [
        {
          inputs: [],
          name: 'getTableName',
          outputs: [{ internalType: 'string', name: '', type: 'string' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      chain: chain,
    })
    const tableName = await readContract({
      contract: tableContract,
      method: 'getTableName' as any,
      params: [],
    })
    const statement = `SELECT * FROM ${tableName}`
    const rows = await queryTable(chain, statement)
    allTables[tableName] = rows
  }

  const filePath = 'data.json'
  const jsonString = JSON.stringify(allTables, null, 2) // null, 2 for pretty printing with 2-space indentation
  fs.writeFile(filePath, jsonString, () => {})

  console.log('allTables')
  console.log(allTables)
}

main().catch(console.error)
