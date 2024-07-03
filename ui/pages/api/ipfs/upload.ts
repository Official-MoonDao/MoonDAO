import { NextApiRequest, NextApiResponse } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const auth = await verifyPrivyAuth(req.headers.authorization)
    if (!auth) {
      return res.status(401).json('Unauthorized')
    }

    const keyRestrictions = {
      keyName: `Signed Upload JWT ${auth.userId}`,
      maxUses: 50,
      permissions: {
        endpoints: {
          data: {
            pinList: false,
            userPinnedDataTotal: false,
          },
          pinning: {
            pinFileToIPFS: true,
            pinJSONToIPFS: false,
            pinJobs: false,
            unpin: false,
            userPinPolicy: false,
          },
        },
      },
    }

    const jwtResponse = await fetch(
      'https://api.pinata.cloud/users/generateApiKey',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
        },
        body: JSON.stringify(keyRestrictions),
      }
    )

    const json = await jwtResponse.json()

    const { JWT } = json

    return res.send(JWT)
  } else {
    return res.status(400)
  }
}
