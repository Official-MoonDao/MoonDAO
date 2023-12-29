import { ethers } from 'ethers'
import { NextApiRequest, NextApiResponse } from 'next'
import dbConnect from '../mongo'
import Nonce from './Nonce'
import User from './User'

const apiKeyMiddleware = async (req: NextApiRequest, res: NextApiResponse) => {
  await dbConnect()

  const apiKey = req.headers['moondao-api-key']

  let { query } = req

  const address = query.address as string

  if (apiKey === process.env.NEXT_PUBLIC_MONGO_MOONDAO_API_KEY) {
    return true
  }

  const nonceRecord = await Nonce.findOne({ address })
  console.log('yo')
  console.log(nonceRecord)
  if (nonceRecord && nonceRecord.nonce) {
    const recoveredAddress = ethers.utils.verifyMessage(
      'Please sign for verify and register your new NFTs into the sweepstakes. #' +
        nonceRecord.nonce,
      apiKey as string
    )
    console.log(address, recoveredAddress)
    if (address === recoveredAddress) {
      return true
    }
  }

  res.status(401).json({ success: false, message: 'Unauthorized' })
  return false
}

export default apiKeyMiddleware
