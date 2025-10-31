// import { ThirdwebSDK } from '@thirdweb-dev/sdk'
// import CitizenABI from 'const/abis/Citizen.json'
// import JBV5MultiTerminal from 'const/abis/JBV5MultiTerminal.json'
// import {
//   DEFAULT_CHAIN_V5,
//   CITIZEN_ADDRESSES,
//   MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
//   FREE_MINT_THRESHOLD,
// } from 'const/config'
// import { rateLimit } from 'middleware/rateLimit'
// import withMiddleware from 'middleware/withMiddleware'
// import { NextApiRequest, NextApiResponse } from 'next'
// import { getContract, readContract } from 'thirdweb'
// import { cacheExchange, createClient, fetchExchange } from 'urql'
// import { getChainSlug } from '@/lib/thirdweb/chain'
// import { serverClient } from '@/lib/thirdweb/client'

// // Configuration constants
// const chain = DEFAULT_CHAIN_V5
// const chainSlug = getChainSlug(chain)
// const privateKey = process.env.XP_ORACLE_SIGNER_PK
// const sdk = ThirdwebSDK.fromPrivateKey(privateKey || '', chainSlug, {
//   secretKey: '',
// })
// const subgraphClient = createClient({
//   url: MOONDAO_MISSIONS_PAYMENT_TERMINAL_SUBGRAPH_URL,
//   exchanges: [fetchExchange, cacheExchange],
// })

// async function POST(req: NextApiRequest, res: NextApiResponse) {
//   const { address, name, image, privacy, formId } = req.body
//   if (!address || !name || !image || !privacy || !formId) {
//     return res.status(400).json({ error: 'Mint params not found!' })
//   }
//   const citizenContract = await sdk.getContract(
//     CITIZEN_ADDRESSES[chainSlug],
//     CitizenABI
//   )
//   const citizenReadContract = getContract({
//     client: serverClient,
//     address: CITIZEN_ADDRESSES[chainSlug],
//     abi: CitizenABI as any,
//     chain: chain,
//   })
//   const balance: any = await readContract({
//     contract: citizenReadContract,
//     method: 'balanceOf' as string,
//     params: [address],
//   })
//   if (balance !== 0) {
//     return res.status(400).json({ error: 'You are already a citizen!' })
//   }
//   const fetchPayments = async () => {
//     const query = `
//       query {
//         backers(first: 100,
//         where: {
//           backer: "${address}"
//         }) {
//           id
//           backer
//           projectId
//           totalAmountContributed
//           numberOfPayments
//           firstContributionTimestamp
//           lastContributionTimestamp
//         }
//       }
//     `
//     const subgraphRes = await subgraphClient.query(query, {}).toPromise()
//     if (subgraphRes.error) {
//       throw new Error(subgraphRes.error.message)
//     }
//     return subgraphRes.data.backers
//   }
//   const payments = await fetchPayments()
//   const totalPaid = payments.reduce((acc: any, payment: any) => {
//     return acc + parseInt(payment.totalAmountContributed)
//   }, 0)
//   if (totalPaid < FREE_MINT_THRESHOLD) {
//     return res.status(400).json({
//       error: 'You have not contributed enough to earn a free citizen NFT!',
//     })
//   }
//   const cost: any = await readContract({
//     contract: citizenReadContract,
//     method: 'getRenewalPrice' as string,
//     params: [address, 365 * 24 * 60 * 60],
//   })
//   const { receipt } = await citizenContract.call(
//     'mintTo',
//     [address, name, '', image, '', '', '', '', privacy, formId],
//     { value: cost }
//   )
//   res.status(200).json(receipt)
// }
// export default withMiddleware(POST, rateLimit)
