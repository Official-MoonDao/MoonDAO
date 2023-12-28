import type { NextApiRequest, NextApiResponse } from 'next'
import MainnetTx from '../../../../lib/mongodb/models/MainnetTx'
import apiKeyMiddleware from '../../../../lib/mongodb/models/middleware'
import dbConnect from '../../../../lib/mongodb/mongo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req

  const auth = await apiKeyMiddleware(req, res)
  if (!auth) return

  await dbConnect()

  switch (method) {
    case 'GET':
      try {
        const mainnetTxs = await MainnetTx.find(
          {}
        ) /* find all the data in our database */
        res.status(200).json({ success: true, data: mainnetTxs })
      } catch (error) {
        console.log(error)
        res.status(400).json({ success: false })
      }
      break
    case 'POST':
      try {
        const mainnetTx = await MainnetTx.create(
          req.body
        ) /* create a new model in the database */
        res.status(201).json({ success: true, data: mainnetTx })
      } catch (error) {
        console.log(error)
        res.status(400).json({ success: false })
      }
      break
    default:
      res.status(400).json({ success: false })
      break
  }
}
