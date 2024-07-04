import { NextApiRequest, NextApiResponse } from 'next'
import { verifyPrivyAuth } from '@/lib/privy/privyAuth'
import formidable from 'formidable'
import fs from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const auth = await verifyPrivyAuth(req.headers.authorization)
    if (!auth || auth.appId !== process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
      return res.status(401).json('Unauthorized')
    }

    const form = formidable({})
    
    try {
      const [fields, files] = await form.parse(req)
      
      const file = Array.isArray(files.file) ? files.file[0] : files.file
      if (!file) {
        return res.status(400).json('No file uploaded')
      }

      const fileContent = await fs.promises.readFile(file.filepath)
      const fileName = file.originalFilename || 'uploaded_file'

      const formData = new FormData()
      formData.append('pinataMetadata', JSON.stringify({ name: fileName }))
      formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }))
      formData.append('file', new Blob([fileContent]))

      const imageRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
        },
        body: formData,
      })

      const json = await imageRes.json()

      if (imageRes.status !== 200) {
        return res.status(400).json('Error pinning file to IPFS')
      }

      const { IpfsHash } = json
      return res.send({ cid: IpfsHash })
    } catch (error) {
      console.error('Error processing request:', error)
      return res.status(500).json('Error processing request')
    }
  } else {
    return res.status(400).json('Invalid method')
  }
}