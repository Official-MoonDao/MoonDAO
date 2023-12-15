import type { NextApiRequest, NextApiResponse } from 'next'
import User from '../../../../lib/mongodb/models/User'
import dbConnect from '../../../../lib/mongodb/mongo'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query } = req

  await dbConnect()

  switch (method) {
    case 'GET':
      try {
        const nonce = Math.floor(Math.random() * 1000000).toString()
        const address = query.address as string
        const subscribed = query.subscribed === 'true'
        const user = await User.findOne({ address })
        if (user) {
          user.nonce = nonce
          user.subscribed = subscribed
          await user.save()
        } else {
          await User.create({ address, nonce, subscribed })
        }

        res.status(200).json({ nonce })
      } catch (error) {
        console.log(error)
        res.status(400).json({ success: false })
      }
      break
  }
}
