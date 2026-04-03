import CitizenABI from 'const/abis/Citizen.json'
import {
  BENDYSTRAW_JB_VERSION,
  DEFAULT_CHAIN_V5,
  CITIZEN_ADDRESSES,
  FREE_MINT_THRESHOLD,
  MISSION_TABLE_NAMES,
} from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)
const privateKey = process.env.XP_ORACLE_SIGNER_PK

// Use the Bendystraw (Juicebox) subgraph which tracks participants and pay events
const bendystrawUrl = `https://${
  process.env.NEXT_PUBLIC_CHAIN !== 'mainnet' ? 'testnet.' : ''
}bendystraw.xyz/${process.env.BENDYSTRAW_API_KEY}/graphql`

const subgraphClient = createClient({
  url: bendystrawUrl,
  exchanges: [fetchExchange, cacheExchange],
})

function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

// Cache MoonDAO mission projectIds (refreshes every 5 minutes)
let cachedProjectIds: number[] = []
let projectIdsCacheTime = 0
const PROJECT_IDS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getMoonDAOProjectIds(): Promise<number[]> {
  const now = Date.now()
  if (cachedProjectIds.length > 0 && now - projectIdsCacheTime < PROJECT_IDS_CACHE_TTL) {
    return cachedProjectIds
  }

  try {
    const tableName = MISSION_TABLE_NAMES[chainSlug]
    if (!tableName) {
      console.error('No MissionTable name for chain:', chainSlug)
      return cachedProjectIds
    }
    const rows = await queryTable(chain, `SELECT projectId FROM ${tableName}`)
    const ids = (rows || [])
      .map((r: any) => Number(r.projectId))
      .filter((id: number) => id > 0 && !isNaN(id))
    if (ids.length > 0) {
      cachedProjectIds = ids
      projectIdsCacheTime = now
    }
    return cachedProjectIds
  } catch (err) {
    console.error('Error fetching MoonDAO project IDs:', err)
    return cachedProjectIds // return stale cache on error
  }
}

async function getTotalPaid(address: string) {
  if (!isValidEvmAddress(address)) {
    throw new Error('Invalid EVM address')
  }

  const moonDAOProjectIds = await getMoonDAOProjectIds()
  if (moonDAOProjectIds.length === 0) return BigInt(0)

  // Query payEvents by beneficiary instead of participants by address.
  // Bendystraw keys Participant.volume by the payer (msg.sender of pay()),
  // which for cross-chain contributions is the CrossChainPay contract, not
  // the user. PayEvent.beneficiary correctly reflects the actual contributor.
  const query = `
    query ($addr: String!, $projectIds: [Int!]!, $version: Int!) {
      payEvents(
        limit: 1000,
        where: {
          beneficiary: $addr,
          projectId_in: $projectIds,
          version: $version
        }
      ) {
        items {
          amount
        }
      }
    }
  `
  const subgraphRes = await subgraphClient.query(query, {
    addr: address.toLowerCase(),
    projectIds: moonDAOProjectIds,
    version: Number(BENDYSTRAW_JB_VERSION),
  }).toPromise()
  if (subgraphRes.error) {
    console.error('Bendystraw query error:', subgraphRes.error)
    throw new Error(subgraphRes.error.message)
  }
  const events = subgraphRes.data?.payEvents?.items || []

  const totalPaid = events.reduce((acc: bigint, e: any) => {
    return acc + BigInt(e.amount || '0')
  }, BigInt(0))
  return totalPaid
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCDNCacheHeaders(res, 60, 60, 'Accept-Encoding, address')
  if (req.method === 'POST') {
    const { address, name, image, privacy, formId } = req.body
    if (!address || !name || !image || !privacy || !formId) {
      return res.status(400).json({ error: 'Mint params not found!' })
    }
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }
    const citizenContract = getContract({
      client: serverClient,
      address: CITIZEN_ADDRESSES[chainSlug],
      abi: CitizenABI as any,
      chain: chain,
    })
    const balance: any = await readContract({
      contract: citizenContract,
      method: 'balanceOf' as string,
      params: [address],
    })
    if (balance !== BigInt(0)) {
      return res.status(400).json({ error: 'You are already a citizen!' })
    }
    const totalPaid = await getTotalPaid(address)
    if (totalPaid < BigInt(FREE_MINT_THRESHOLD)) {
      return res.status(400).json({
        error: 'You have not contributed enough to earn a free citizen NFT!',
      })
    }
    const cost: any = await readContract({
      contract: citizenContract,
      method: 'getRenewalPrice' as string,
      params: [address, 365 * 24 * 60 * 60],
    })
    const account = await createHSMWallet()
    const transaction = prepareContractCall({
      contract: citizenContract,
      method: 'mintTo' as string,
      params: [address, name, '', image, '', '', '', '', privacy, formId],
      value: cost,
    })
    const receipt = await sendAndConfirmTransaction({
      transaction,
      account,
    })
    const jsonReceipt = JSON.stringify(receipt, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return value
    })
    res.status(200).json(JSON.parse(jsonReceipt))
  }
  if (req.method === 'GET') {
    const address = req.query.address

    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Address is required.' })
    }
    if (!isValidEvmAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format.' })
    }

    const totalPaid = await getTotalPaid(address as string)
    res.status(200).json({
      success: true,
      message: 'Fetched total paid.',
      data: {
        totalPaid: totalPaid.toString(),
        eligible: totalPaid >= BigInt(FREE_MINT_THRESHOLD),
      },
    })
  }
}
export default withMiddleware(handler, rateLimit)
