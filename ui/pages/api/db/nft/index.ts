import type { NextApiRequest, NextApiResponse } from 'next'
import Nft from '../../../../lib/mongodb/models/Nft'
import dbConnect from '../../../../lib/mongodb/mongo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect()

  const { method } = req

  await dbConnect()

  switch (method) {
    case 'GET':
      try {
        const nfts = await Nft.find({}) /* find all the data in our database */
        res.status(200).json({ success: true, data: nfts })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
    case 'POST':
      try {
        const nft = await Nft.create(
          req.body
        ) /* create a new model in the database */
        res.status(201).json({ success: true, data: nft })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
    default:
      res.status(400).json({ success: false })
      break
  }
}
