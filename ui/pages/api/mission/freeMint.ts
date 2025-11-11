import CitizenABI from 'const/abis/Citizen.json'
import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
import {
  DEFAULT_CHAIN_V5,
  CITIZEN_ADDRESSES,
  MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  FREE_MINT_THRESHOLD,
} from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  readContract,
  prepareContractCall,
  sendAndConfirmTransaction,
  sendTransaction,
  getContract,
} from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import { createHSMWallet } from '@/lib/google/hsm-signer'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/client'

type CachedBackers = {
  data: Backer[]
  timestamp: number
}

const backersCache: Map<string, CachedBackers> = new Map()
const CACHE_TTL = 30 * 1000 // 30 seconds

// Configuration constants
const chain = DEFAULT_CHAIN_V5
const chainSlug = getChainSlug(chain)
const privateKey = process.env.XP_ORACLE_SIGNER_PK
const subgraphClient = createClient({
  url: MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
  exchanges: [fetchExchange, cacheExchange],
})

async function getTotalPaid(address: string) {
  const now = Date.now()
  const cached = backersCache.get(address)

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  const fetchPayments = async () => {
    const query = `
      query {
        backers(first: 100,
        where: {
          backer: "${address}"
        }) {
          id
          backer
          projectId
          totalAmountContributed
          numberOfPayments
          firstContributionTimestamp
          lastContributionTimestamp
        }
      }
    `
    const subgraphRes = await subgraphClient.query(query, {}).toPromise()
    if (subgraphRes.error) {
      console.log(error)
      throw new Error(subgraphRes.error.message)
    }
    return subgraphRes.data.backers
  }
  const payments = await fetchPayments()
  const totalPaid = payments.reduce((acc: any, payment: any) => {
    return acc + parseInt(payment.totalAmountContributed)
  }, 0)
  backersCache.set(address, {
    data: totalPaid,
    timestamp: now,
  })
  return totalPaid
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { address, name, image, privacy, formId } = req.body
    if (!address || !name || !image || !privacy || !formId) {
      return res.status(400).json({ error: 'Mint params not found!' })
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
    if (balance !== 0) {
      return res.status(400).json({ error: 'You are already a citizen!' })
    }
    const totalPaid = await getTotalPaid(address)
    if (totalPaid < FREE_MINT_THRESHOLD) {
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

    const totalPaid = await getTotalPaid(address)
    res.status(200).json({
      success: true,
      message: 'Fetched total paid.',
      data: {
        totalPaid: totalPaid,
        eligible: totalPaid >= FREE_MINT_THRESHOLD,
      },
    })
  }
}
export default withMiddleware(handler, rateLimit)
