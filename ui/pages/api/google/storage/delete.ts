import { Storage } from '@google-cloud/storage'
import { NextApiRequest, NextApiResponse } from 'next'

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS || '', 'base64').toString('utf-8')
)

const storage = new Storage({ credentials })
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'storage-uploader')

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { filename, url } = req.body

  if (!filename && !url) {
    return res.status(400).json({
      error: 'Either filename or url is required',
    })
  }

  // Extract filename from URL if URL is provided
  let fileToDelete = filename
  if (url && !filename) {
    // Extract filename from Google Cloud Storage URL
    // Format: https://storage.googleapis.com/bucket-name/path/to/file
    const urlParts = url.split('/')
    fileToDelete = urlParts.slice(4).join('/') // Everything after bucket name
  }

  if (!fileToDelete) {
    return res.status(400).json({ error: 'Invalid filename or url' })
  }

  try {
    const file = bucket.file(fileToDelete)

    // Check if file exists
    const [exists] = await file.exists()
    if (!exists) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Delete the file
    await file.delete()

    res.status(200).json({
      message: 'File deleted successfully',
      filename: fileToDelete,
    })
  } catch (deleteError) {
    console.error('Delete error:', deleteError)
    res.status(500).json({ error: 'Failed to delete file' })
  }
}
