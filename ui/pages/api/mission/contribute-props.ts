import { MISSION_TABLE_NAMES } from 'const/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import {
  fetchMissionContracts,
  fetchMissionRow,
} from '@/lib/mission/fetchMissionServerData'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'

function asDecimal(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 })
  }
  if (value == null) return '0'
  const text = String(value)
  return text === '[object Object]' ? '0' : text
}

/**
 * Props for the launchpad contribution modal, keyed by the Juicebox project
 * a prize pool pays into. The DePrize fund button renders that modal directly.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const projectId = Number(req.query.projectId)
  const chainId = Number(req.query.chainId)
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: 'Invalid project id' })
  }
  const chain = getChainById(chainId)
  if (!chain) {
    return res.status(400).json({ error: 'Invalid chain' })
  }

  const tableName = MISSION_TABLE_NAMES[getChainSlug(chain)]
  if (!tableName) {
    return res.status(404).json({ error: 'No launchpad on this chain' })
  }

  try {
    const rows = await queryTable(chain, `SELECT id FROM ${tableName} WHERE projectId = ${projectId}`)
    const missionId = Number(rows?.[0]?.id)
    if (!Number.isInteger(missionId) || missionId <= 0) {
      return res.status(404).json({ error: 'No launchpad mission for this prize pool' })
    }

    const missionRow = await fetchMissionRow(missionId, chain)
    if (!missionRow) {
      return res.status(404).json({ error: 'No launchpad mission for this prize pool' })
    }

    const contractData = await fetchMissionContracts(missionRow.projectId, missionId, chain)
    const ipfsHash = String(contractData.metadataURI || '').replace(/^ipfs:\/\//, '')
    const metadata = ipfsHash
      ? await fetchFromIPFSWithFallback(ipfsHash, 8000).catch(() => ({
          name: 'Launchpad',
          description: '',
          logoUri: '',
        }))
      : { name: 'Launchpad', description: '', logoUri: '' }
    const token = await fetchTokenMetadata(contractData.tokenAddress, chain)
    const ruleset = contractData.ruleset
    if (!ruleset?.[0] || !ruleset?.[1]) {
      return res.status(404).json({ error: 'Launchpad ruleset is not available' })
    }

    return res.status(200).json({
      mission: {
        id: missionRow.id,
        teamId: missionRow.teamId,
        projectId: Number(missionRow.projectId),
        metadata,
      },
      primaryTerminalAddress: contractData.primaryTerminalAddress,
      token,
      ruleset: [
        { weight: asDecimal(ruleset[0].weight) },
        { reservedPercent: asDecimal(ruleset[1].reservedPercent) },
      ],
    })
  } catch (err) {
    console.error('[mission/contribute-props]', err)
    return res.status(500).json({ error: 'Could not load the launchpad contribution' })
  }
}
