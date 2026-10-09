import JobBoardTableABI from 'const/abis/JobBoardTable.json'
import MarketplaceTableABI from 'const/abis/MarketplaceTable.json'
import {
  DEFAULT_CHAIN_V5,
  JOBS_TABLE_ADDRESSES,
  MARKETPLACE_TABLE_ADDRESSES,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getContract, prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { createHSMWallet, isHSMAvailable } from '@/lib/google/hsm-signer'
import { getPrivyUserData } from '@/lib/privy'
import { fetchProjectRow, findProjectManagerWallet } from '@/lib/project/projectAccess'
import { toProjectOwnerId } from '@/lib/project/projectOwnerId'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import { authOptions } from '../auth/[...nextauth]'

// Projects have no manager check on the jobs and marketplace tables, so their
// managers write through the HSM wallet, which is an operator on both tables.
// Operators skip the team check entirely, which makes this route the only
// thing tying a row to a project: `teamId` is always derived from `projectId`.

type Table = 'jobs' | 'marketplace'
type Action = 'insert' | 'update' | 'delete'

const MAX_FIELD_BYTES = 20_000

const JOB_FIELDS = ['title', 'description', 'tag', 'metadata', 'contactInfo'] as const
const LISTING_FIELDS = [
  'title',
  'description',
  'image',
  'price',
  'currency',
  'tag',
  'metadata',
  'shipping',
] as const

function readString(fields: any, key: string): string | null {
  const value = fields?.[key] ?? ''
  if (typeof value !== 'string') return null
  if (Buffer.byteLength(value, 'utf8') > MAX_FIELD_BYTES) return null
  // Callers send values already escaped with `cleanData`. A lone quote would
  // end the SQL literal that `SQLHelpers.quote` builds on-chain.
  if (value.replace(/''/g, '').includes("'")) return null
  return value
}

function readUint(fields: any, key: string): number | null {
  const value = Number(fields?.[key] ?? 0)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function buildParams(table: Table, fields: any, teamId: number): any[] | string {
  const strings: Record<string, string> = {}
  for (const key of table === 'jobs' ? JOB_FIELDS : LISTING_FIELDS) {
    const value = readString(fields, key)
    if (value === null) return `Invalid ${key}`
    strings[key] = value
  }
  const endTime = readUint(fields, 'endTime')
  const timestamp = readUint(fields, 'timestamp')
  if (endTime === null || timestamp === null) return 'Invalid endTime or timestamp'

  if (table === 'jobs') {
    if (!strings.title || !strings.description || !strings.contactInfo) {
      return 'Title, description and contact info are required'
    }
    return [
      strings.title,
      strings.description,
      teamId,
      strings.tag,
      strings.metadata,
      endTime,
      timestamp,
      strings.contactInfo,
    ]
  }

  const startTime = readUint(fields, 'startTime')
  if (startTime === null) return 'Invalid startTime'
  if (!strings.title || !strings.price || !strings.currency) {
    return 'Title, price and currency are required'
  }
  return [
    strings.title,
    strings.description,
    strings.image,
    teamId,
    strings.price,
    strings.currency,
    startTime,
    endTime,
    timestamp,
    strings.tag,
    strings.metadata,
    strings.shipping,
  ]
}

/** `JobInserted` / `ListingInserted` both index the new row id first. */
function readInsertedId(receipt: any, tableAddress: string): string | undefined {
  const log = receipt?.logs?.find(
    (entry: any) =>
      entry?.address?.toLowerCase() === tableAddress.toLowerCase() && entry?.topics?.length === 3
  )
  return log ? BigInt(log.topics[1]).toString() : undefined
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { table, action, projectId: rawProjectId, rowId: rawRowId, fields } = req.body ?? {}
  if (table !== 'jobs' && table !== 'marketplace') {
    return res.status(400).json({ error: 'table must be jobs or marketplace' })
  }
  if (action !== 'insert' && action !== 'update' && action !== 'delete') {
    return res.status(400).json({ error: 'action must be insert, update or delete' })
  }
  const projectId = Number(rawProjectId)
  if (!Number.isSafeInteger(projectId) || projectId < 0) {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  const rowId = Number(rawRowId)
  if (action !== 'insert' && (!Number.isSafeInteger(rowId) || rowId < 0)) {
    return res.status(400).json({ error: 'Invalid rowId' })
  }

  const authHeader = req.headers.authorization
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (await getServerSession(req, res, authOptions))?.accessToken
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const privyUserData = await getPrivyUserData(accessToken)
  if (!privyUserData?.walletAddresses?.length) {
    return res.status(401).json({ error: 'No wallet addresses found' })
  }

  const chain = DEFAULT_CHAIN_V5
  const project = await fetchProjectRow(chain, projectId)
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  const manager = await findProjectManagerWallet(
    chain,
    { id: projectId, proposalIPFS: project.proposalIPFS },
    privyUserData.walletAddresses
  )
  if (!manager) {
    return res.status(403).json({ error: 'Only project managers and leads can do this' })
  }

  const teamId = toProjectOwnerId(projectId)
  let method: string
  let params: any[]
  if (action === 'delete') {
    method = 'deleteFromTable'
    params = [rowId, teamId]
  } else {
    const built = buildParams(table, fields, teamId)
    if (typeof built === 'string') return res.status(400).json({ error: built })
    method = action === 'insert' ? 'insertIntoTable' : 'updateTable'
    params = action === 'insert' ? built : [rowId, ...built]
  }

  if (!isHSMAvailable()) {
    return res.status(500).json({ error: 'Signer unavailable' })
  }

  const chainSlug = getChainSlug(chain)
  const tableAddress =
    table === 'jobs' ? JOBS_TABLE_ADDRESSES[chainSlug] : MARKETPLACE_TABLE_ADDRESSES[chainSlug]

  try {
    const contract = getContract({
      client: serverClient,
      address: tableAddress,
      chain,
      abi: (table === 'jobs' ? JobBoardTableABI : MarketplaceTableABI) as any,
    })
    const account = await createHSMWallet()
    // The contract rejects updates/deletes unless `idToTeamId[rowId]` is this
    // project, so a manager can't touch another owner's rows.
    const receipt = await sendAndConfirmTransaction({
      transaction: prepareContractCall({ contract, method, params } as any),
      account,
    })
    return res.status(200).json({
      transactionHash: receipt.transactionHash,
      rowId: action === 'insert' ? readInsertedId(receipt, tableAddress) : String(rowId),
      teamId,
    })
  } catch (error: any) {
    console.error('[project/table-write] failed:', { table, action, projectId, error })
    return res.status(500).json({ error: error?.shortMessage || error?.message || 'Write failed' })
  }
}

export const maxDuration = 60

export default withMiddleware(handler, rateLimit, authMiddleware)
