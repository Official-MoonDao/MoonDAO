import type { NextApiRequest, NextApiResponse } from 'next'
import MainnetTx from '../../../../lib/mongodb/models/MainnetTx'
import apiKeyMiddleware from '../../../../lib/mongodb/models/middleware'
import dbConnect from '../../../../lib/mongodb/mongo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    query: { id },
    method,
  } = req

  const auth = await apiKeyMiddleware(req, res)
  if (!auth) return

  await dbConnect()

  switch (method) {
    case 'GET' /* Get a model by its ID */:
      try {
        const mainnetTx = await MainnetTx.find({address: id})
        if (!mainnetTx) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: mainnetTx })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break

    case 'PUT' /* Edit a model by its ID */:
      try {
        const mainnetTx = await MainnetTx.findByIdAndUpdate(id, req.body, {
          new: true,
          runValidators: true,
        })
        if (!mainnetTx) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: mainnetTx })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break

    case 'DELETE' /* Delete a model by its ID */:
      try {
        const deletedMainnetTx = await MainnetTx.deleteOne({ _id: id })
        if (!deletedMainnetTx) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: {} })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break

    default:
      res.status(400).json({ success: false })
      break
  }
}
