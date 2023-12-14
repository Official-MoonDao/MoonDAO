import type { NextApiRequest, NextApiResponse } from 'next'
import User from '../../../../lib/mongodb/models/User'
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
        const user = await User.findById(id)
        if (!user) {
          return res.status(400).json({ success: false })
        }
        res.status(200).json({ success: true, data: user })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
  }
}
