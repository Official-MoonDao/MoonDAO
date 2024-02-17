import { NextApiRequest, NextApiResponse } from 'next'

const keyRestrictions = {
  keyName: 'Signed Update JWT',
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
        unpin: true,
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
