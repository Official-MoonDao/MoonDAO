import { Sepolia } from '@thirdweb-dev/chains'
import { ethers } from 'ethers'
import { NextApiRequest, NextApiResponse } from 'next'
import { initSDK } from '@/lib/thirdweb/thirdweb'

const keyRestrictions = {
  keyName: 'Signed Upload JWT',
  maxUses: 3,
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const signature = req.headers.signature as string
    const { address, message } = JSON.parse(req.body)

    const recoveredAddress = ethers.utils.verifyMessage(message, signature)
    if (recoveredAddress !== address) {
      return res.status(401).send('Unauthorized')
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
