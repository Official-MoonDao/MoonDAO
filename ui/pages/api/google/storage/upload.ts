import { Storage } from '@google-cloud/storage'
import formidable from 'formidable'
import { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: false,
  },
}

// Add error handling for credentials parsing
let credentials: any
let storage: Storage
let bucket: any

try {
  if (!process.env.GCS_CREDENTIALS) {
    throw new Error('GCS_CREDENTIALS environment variable is not set')
  }

  credentials = JSON.parse(
    Buffer.from(process.env.GCS_CREDENTIALS, 'base64').toString('utf-8')
  )

  storage = new Storage({ credentials })

  if (!process.env.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set')
  }

  bucket = storage.bucket(process.env.GCS_BUCKET_NAME)
} catch (initError) {
  console.error('Google Cloud Storage initialization error:', initError)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if storage is properly initialized
  if (!storage || !bucket) {
    return res.status(500).json({ error: 'Storage service not available' })
  }

  try {
    // Use formidable v3 API
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    })

    // Parse the form data using v3 API
    const [fields, files] = await form.parse(req)

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

    // Preserve file extension at the end by adding timestamp before the extension
    const filename = file.originalFilename
    const lastDotIndex = filename.lastIndexOf('.')
    const nameWithoutExt =
      lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
    const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''
    const destination = `${nameWithoutExt}-${Date.now()}${extension}`

    await bucket.upload(file.filepath, {
      destination,
      metadata: {
        contentType: file.mimetype || 'application/octet-stream',
      },
    })

    // Generate a signed URL for access (expires in 1 hour)
    const [signedUrl] = await bucket.file(destination).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })

    const response = { message: 'File uploaded', url: signedUrl }

    return res.status(200).json(response)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown upload error'
    return res
      .status(500)
      .json({ error: 'Upload failed', details: errorMessage })
  }
}
