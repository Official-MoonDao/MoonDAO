import { SignJWT } from 'jose'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

interface OnrampJwtRequest {
  address: string
  chainSlug: string
  usdAmount?: string
  agreed?: boolean
  message?: string
  selectedWallet?: number
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const {
      address,
      chainSlug,
      usdAmount,
      agreed,
      message,
      selectedWallet,
    }: OnrampJwtRequest = req.body

    if (!address || !chainSlug) {
      return res
        .status(400)
        .json({ error: 'Address and chainSlug are required' })
    }

    const secret = process.env.ONRAMP_JWT_SECRET
    if (!secret) {
      return res.status(500).json({
        error: 'Server configuration error: JWT secret not found',
      })
    }

    const secretKey = new TextEncoder().encode(secret)
    const now = Math.floor(Date.now() / 1000)

    const jwt = await new SignJWT({
      address,
      chainSlug,
      usdAmount,
      agreed,
      message: message || '',
      selectedWallet,
      timestamp: now,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('3h') // Valid for 3 hours
      .sign(secretKey)

    return res.status(200).json({ jwt })
  } catch (error: any) {
    console.error('Error generating onramp JWT:', error)
    return res.status(500).json({ error: 'Failed to generate JWT' })
  }
}

export default withMiddleware(handler, authMiddleware)
