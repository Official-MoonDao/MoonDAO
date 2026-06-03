import { Storage } from '@google-cloud/storage'
import { NextApiRequest, NextApiResponse } from 'next'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'

const UPLOAD_PREFIX = 'citizen-gen-temp/'

let storage: Storage
let bucket: ReturnType<Storage['bucket']>

try {
  if (process.env.GCS_CREDENTIALS) {
    const credentials = JSON.parse(
      Buffer.from(process.env.GCS_CREDENTIALS, 'base64').toString('utf-8'),
    )
    storage = new Storage({ credentials })
    if (process.env.GCS_BUCKET_NAME) {
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME)
    }
  }
} catch (initError) {
  console.error('GCS initialization failed (image-gen delete-input):', initError)
}

function isAllowedTempFile(filename: string): boolean {
  const normalized = filename.replace(/^\/+/, '')
  return normalized.startsWith(UPLOAD_PREFIX) && !normalized.includes('..')
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!storage || !bucket) {
    return res.status(500).json({ error: 'Storage service not available' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const filename = body?.filename as string | undefined

    if (!filename || !isAllowedTempFile(filename)) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const file = bucket.file(filename)
    const [exists] = await file.exists()
    if (!exists) {
      return res.status(404).json({ error: 'File not found' })
    }

    await file.delete()
    return res.status(200).json({ message: 'File deleted', filename })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown delete error'
    return res.status(500).json({ error: 'Failed to delete file', details: errorMessage })
  }
}

export default withMiddleware(handler, authMiddleware)
