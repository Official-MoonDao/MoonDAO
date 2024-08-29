import formidable from 'formidable'
import fs from 'fs'
import { privyAuth } from 'middleware/privyAuth'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const form = formidable({})

    try {
      const [_fields, files] = await form.parse(req)

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

      const imageRes = await fetch(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT_KEY}`,
          },
          body: formData,
        }
      )

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

export default withMiddleware(handler, privyAuth)
