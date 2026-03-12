import CitizenABI from 'const/abis/Citizen.json'
import {
  BENDYSTRAW_JB_VERSION,
  DEFAULT_CHAIN_V5,
  CITIZEN_ADDRESSES,
  FREE_MINT_THRESHOLD,
} from 'const/config'
import { setCDNCacheHeaders } from 'middleware/cacheHeaders'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { readContract, prepareContractCall, sendAndConfirmTransaction, getContract } from 'thirdweb'
import { cacheExchange, createClient, fetchExchange } from 'urql'
import { createHSMWallet } from '@/lib/google/hsm-signer'
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

async function getTotalPaid(address: string) {
  const query = `
    query {
      participants(
        limit: 100,
        where: {
          address: "${address.toLowerCase()}",
          version: ${BENDYSTRAW_JB_VERSION},
          chainId: ${chain.id}
        }
      ) {
        items {
          address
          projectId
          volume
          paymentsCount
        }
      }
    }
  `
  const subgraphRes = await subgraphClient.query(query, {}).toPromise()
  if (subgraphRes.error) {
    console.error('Bendystraw query error:', subgraphRes.error)
    throw new Error(subgraphRes.error.message)
  }
  const participants = subgraphRes.data?.participants?.items || []
  const totalPaid = participants.reduce((acc: bigint, p: any) => {
    return acc + BigInt(p.volume || '0')
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
