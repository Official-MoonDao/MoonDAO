import { NextApiRequest, NextApiResponse } from 'next'
import { buyDNAKit } from '../../../../lib/lifeship-shopify'

//1 Human
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { quantity, walletAddress } = JSON.parse(req.body)
    console.log(quantity)
    try {
      const checkoutURL = await buyDNAKit(quantity, walletAddress)
      return res.status(200).json({ checkoutURL })
    } catch (err) {
      console.log(err)
      return res.status(500)
    }
  } else {
    return res.status(400)
  }
}
