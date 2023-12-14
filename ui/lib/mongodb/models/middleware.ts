import { ethers } from 'ethers'
import { NextApiRequest, NextApiResponse } from 'next'

const apiKeyMiddleware = async (req: NextApiRequest, res: NextApiResponse) => {
  const apiKey = req.headers['moondao-api-key']

  let { query } = req

  const address = query.address as string

  if (apiKey === process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY) {
    return true
  }
  const recoveredAddress = ethers.utils.verifyMessage(
    process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY as string,
    apiKey as string
  )
  if (address === recoveredAddress) {
    return true
  }

  res.status(401).json({ success: false, message: 'Unauthorized' })
  return false
}

export default apiKeyMiddleware
