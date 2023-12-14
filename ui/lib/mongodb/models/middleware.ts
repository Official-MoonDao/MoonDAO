import { ethers } from 'ethers'
import { NextApiRequest, NextApiResponse } from 'next'
import dbConnect from '../mongo'
import User from './User'

const apiKeyMiddleware = async (req: NextApiRequest, res: NextApiResponse) => {
  await dbConnect()

  const apiKey = req.headers['moondao-api-key']

  let { query } = req

  const address = query.address as string

  if (apiKey === process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY) {
    return true
  }

  const user = await User.findOne({ address })
  if (user && user.nonce) {
    const recoveredAddress = ethers.utils.verifyMessage(
      user.nonce,
      apiKey as string
    )
    if (address === recoveredAddress) {
      return true
    }
  }

  res.status(401).json({ success: false, message: 'Unauthorized' })
  return false
}

export default apiKeyMiddleware
