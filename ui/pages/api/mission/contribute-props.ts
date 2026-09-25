import { MISSION_TABLE_NAMES } from 'const/config'
import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import { findMissionByJuiceboxProject } from '@/lib/mission/findMissionByProject'
import {
  fetchMissionContracts,
  fetchMissionRow,
} from '@/lib/mission/fetchMissionServerData'
import { fetchTokenMetadata } from '@/lib/mission/fetchTokenServerData'
import queryTable from '@/lib/tableland/queryTable'
import { getChainById, getChainSlug } from '@/lib/thirdweb/chain'

const CACHE_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; body: unknown }>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      }
    )
  })
}

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

  const cacheKey = `${chain.id}:${projectId}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json(cached.body)
  }

  try {
    // The public table and the DePrize creator scan used to run one after the
    // other. A miss on Tableland (the Sepolia prize pools) waited out that
    // query, including its retries, before any chain read started.
    const [rows, scanned] = await Promise.all([
      withTimeout(
        queryTable(chain, `SELECT id FROM ${tableName} WHERE projectId = ${projectId}`),
        1500
      ),
      findMissionByJuiceboxProject(chain as any, projectId),
    ])
    const listedId = Number(rows?.[0]?.id)
    const missionRow =
      Number.isInteger(listedId) && listedId > 0
        ? await fetchMissionRow(listedId, chain)
        : scanned
    if (!missionRow) {
      return res.status(404).json({ error: 'No launchpad mission for this prize pool' })
    }

    const contractData = await fetchMissionContracts(missionRow.projectId, missionRow.id, chain)
    const ipfsHash = String(contractData.metadataURI || '').replace(/^ipfs:\/\//, '')
    const [metadata, token] = await Promise.all([
      ipfsHash
        ? withTimeout(fetchFromIPFSWithFallback(ipfsHash, 1500), 1800).then(
            (value) => value ?? { name: 'Launchpad', description: '', logoUri: '' }
          )
        : Promise.resolve({ name: 'Launchpad', description: '', logoUri: '' }),
      fetchTokenMetadata(contractData.tokenAddress, chain),
    ])
    const ruleset = contractData.ruleset
    if (!ruleset?.[0] || !ruleset?.[1]) {
      return res.status(404).json({ error: 'Launchpad ruleset is not available' })
    }

    const body = {
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
    }
    cache.set(cacheKey, { at: Date.now(), body })
    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json(body)
  } catch (err) {
    console.error('[mission/contribute-props]', err)
    return res.status(500).json({ error: 'Could not load the launchpad contribution' })
  }
}
