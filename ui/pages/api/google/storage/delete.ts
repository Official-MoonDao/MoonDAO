import { Storage } from '@google-cloud/storage'
import { NextApiRequest, NextApiResponse } from 'next'

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
  console.error('❌ GCS initialization failed:', initError)
}

function extractFilenameFromUrl(url: string): string | null {
  try {
    // Handle both signed URLs and regular storage URLs
    // Signed URL format: https://storage.googleapis.com/bucket-name/path/to/file?X-Goog-Algorithm=...
    // Regular URL format: https://storage.googleapis.com/bucket-name/path/to/file
    const urlObj = new URL(url)

    // Check if it's a Google Storage URL
    if (
      !urlObj.hostname.includes('googleapis.com') &&
      !urlObj.hostname.includes('storage.cloud.google.com')
    ) {
      return null
    }

    const pathParts = urlObj.pathname.split('/')
    // Remove empty first element and bucket name
    const bucketName = process.env.GCS_BUCKET_NAME
    const bucketIndex = pathParts.findIndex((part) => part === bucketName)

    if (bucketIndex === -1) {
      return null
    }

    // Everything after the bucket name is the filename
    const filename = pathParts.slice(bucketIndex + 1).join('/')
    return filename || null
  } catch (error) {
    return null
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if storage is properly initialized
  if (!storage || !bucket) {
    return res.status(500).json({ error: 'Storage service not available' })
  }

  try {
    const { filename, url } = req.body

    if (!filename && !url) {
      return res.status(400).json({
        error: 'Either filename or url is required',
      })
    }

    // Extract filename from URL if URL is provided
    let fileToDelete = filename
    if (url && !filename) {
      fileToDelete = extractFilenameFromUrl(url)
    }

    if (!fileToDelete) {
      return res.status(400).json({ error: 'Invalid filename or url' })
    }

    const file = bucket.file(fileToDelete)

    // Check if file exists
    const [exists] = await file.exists()
    if (!exists) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Delete the file
    await file.delete()

    return res.status(200).json({
      message: 'File deleted successfully',
      filename: fileToDelete,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown delete error'
    return res.status(500).json({
      error: 'Failed to delete file',
      details: errorMessage,
    })
  }
}
