import type { NextApiRequest, NextApiResponse } from 'next'
import Nft from '../../../../lib/mongodb/models/Nft'
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

  await dbConnect()

  switch (method) {
    case 'GET' /* Get a model by its ID */:
      try {
        const nft = await Nft.findById(id)
        if (!nft) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: nft })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break

    case 'PUT' /* Edit a model by its ID */:
      try {
        const auth = apiKeyMiddleware(req, res)
        if (!auth) return
        const nft = await Nft.findByIdAndUpdate(id, req.body, {
          new: true,
          runValidators: true,
        })
        if (!nft) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: nft })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break

    case 'DELETE' /* Delete a model by its ID */:
      try {
        const auth = apiKeyMiddleware(req, res)
        if (!auth) return
        const deletedNft = await Nft.deleteOne({ _id: id })
        if (!deletedNft) {
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
