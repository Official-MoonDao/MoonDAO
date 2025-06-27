import { Storage } from '@google-cloud/storage'
import { IncomingForm } from 'formidable'
import { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

const credentials = JSON.parse(
  Buffer.from(process.env.GCS_CREDENTIALS || '', 'base64').toString('utf-8')
)

const storage = new Storage({ credentials })
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'storage-uploader')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const form = new IncomingForm()

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Error parsing form' })
    }

    const fileData = files.file
    if (!fileData) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = Array.isArray(fileData) ? fileData[0] : fileData

    if (!file.filepath) {
      return res.status(400).json({ error: 'File path is missing' })
    }

    if (!file.originalFilename) {
      return res.status(400).json({ error: 'Original filename is missing' })
    }

    const destination = `citizen-uploads/${
      file.originalFilename + '-' + Date.now()
    }`

    try {
      await bucket.upload(file.filepath, {
        destination,
        metadata: {
          contentType: file.mimetype || 'application/octet-stream',
        },
        public: true,
      })

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`

      res.status(200).json({ message: 'File uploaded', url: publicUrl })
    } catch (uploadError) {
      console.error(uploadError)
      res.status(500).json({ error: 'Upload failed' })
    }
  })
}
