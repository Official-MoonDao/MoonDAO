import { jwtVerify } from 'jose'
import { authMiddleware } from 'middleware/authMiddleware'
import { secureHeaders } from 'middleware/secureHeaders'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

interface VerifyJwtRequest {
  token: string
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  secureHeaders(res)

  try {
    const { token }: VerifyJwtRequest = req.body

    if (!token) {
      return res.status(400).json({ error: 'Token is required' })
    }

    const secret = process.env.ONRAMP_JWT_SECRET
    if (!secret) {
      return res.status(500).json({
        error: 'Server configuration error: JWT secret not found',
      })
    }

    const secretKey = new TextEncoder().encode(secret)

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ['HS256'],
      })

      return res.status(200).json({
        valid: true,
        payload: payload,
      })
    } catch (verifyError: any) {
      // JWT verification failed (expired, invalid signature, etc.)
      return res.status(200).json({
        valid: false,
        error: verifyError.message || 'Invalid or expired JWT',
      })
    }
  } catch (error: any) {
    console.error('Error verifying onramp JWT:', error)
    return res.status(500).json({ error: 'Failed to verify JWT' })
  }
}

export default withMiddleware(handler, authMiddleware)
