import { NextApiRequest, NextApiResponse } from 'next'
import { getProductByHandle } from '../../../../lib/lifeship-shopify'

//1 Human
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { handle } = JSON.parse(req.body)
    try {
      const product = await getProductByHandle(handle)
      return res.status(200).json({ product })
    } catch (err) {
      console.log(err)
      return res.status(500)
    }
  } else {
    return res.status(400)
  }
}
