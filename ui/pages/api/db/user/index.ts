import type { NextApiRequest, NextApiResponse } from 'next'
import User from '../../../../lib/mongodb/models/User'
import apiKeyMiddleware from '../../../../lib/mongodb/models/middleware'
import dbConnect from '../../../../lib/mongodb/mongo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = apiKeyMiddleware(req, res)
  if (!auth) return

  await dbConnect()

  const { method } = req

  await dbConnect()

  switch (method) {
    case 'GET':
      try {
        const users = await User.find(
          {}
        ) /* find all the data in our database */
        res.status(200).json({ success: true, data: users })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
    case 'POST':
      try {
        const user = await User.create(
          req.body
        ) /* create a new model in the database */
        res.status(201).json({ success: true, data: user })
      } catch (error) {
        res.status(400).json({ success: false })
      }
      break
    default:
      res.status(400).json({ success: false })
      break
  }
}
