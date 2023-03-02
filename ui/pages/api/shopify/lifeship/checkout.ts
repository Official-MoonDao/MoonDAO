import { NextApiRequest, NextApiResponse } from 'next'
import { checkout } from '../../../../lib/lifeship-shopify'

//1 Human
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const { quantityDNA, quantityAshes, quantityNFT, walletAddress } =
        await JSON.parse(req.body)
      const checkoutURL = await checkout(
        quantityDNA,
        quantityAshes,
        quantityNFT,
        walletAddress
      )
      return res.status(200).json({ checkoutURL })
    } catch (err) {
      console.log(err)
      return res.status(500)
    }
  } else {
    return res.status(400)
  }
}
