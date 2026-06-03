import { Storage } from '@google-cloud/storage'
import formidable from 'formidable'
import { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'

/** Temp uploads for citizen AI generation (readable by comfy.icu via signed URL). */
const UPLOAD_PREFIX = 'citizen-gen-temp/'
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const config = {
  api: {
    bodyParser: false,
  },
}

let storage: Storage
let bucket: ReturnType<Storage['bucket']>

try {
  if (!process.env.GCS_CREDENTIALS) {
    throw new Error('GCS_CREDENTIALS environment variable is not set')
  }

  const credentials = JSON.parse(
    Buffer.from(process.env.GCS_CREDENTIALS, 'base64').toString('utf-8'),
  )

  storage = new Storage({ credentials })

  if (!process.env.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME environment variable is not set')
  }

  bucket = storage.bucket(process.env.GCS_BUCKET_NAME)
} catch (initError) {
  console.error('GCS initialization failed (image-gen upload-input):', initError)
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!storage || !bucket) {
    return res.status(500).json({ error: 'Storage service not available' })
  }

  try {
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024,
    })

    const [, files] = await form.parse(req)
    const fileData = files.file
    if (!fileData) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const file = Array.isArray(fileData) ? fileData[0] : fileData

    if (!file.filepath || !file.originalFilename) {
      return res.status(400).json({ error: 'Invalid file upload' })
    }

    const mime = file.mimetype || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return res.status(400).json({ error: 'Unsupported file type' })
    }

    const safeBasename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const lastDotIndex = safeBasename.lastIndexOf('.')
    const nameWithoutExt = lastDotIndex > 0 ? safeBasename.substring(0, lastDotIndex) : safeBasename
    const extension = lastDotIndex > 0 ? safeBasename.substring(lastDotIndex) : '.jpg'
    const destination = `${UPLOAD_PREFIX}${nameWithoutExt}-${Date.now()}${extension}`

    await bucket.upload(file.filepath, {
      destination,
      metadata: { contentType: mime },
    })

    const [signedUrl] = await bucket.file(destination).getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    })

    return res.status(200).json({ url: signedUrl, filename: destination })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'
    return res.status(500).json({ error: 'Upload failed', details: errorMessage })
  }
}

export default handler
