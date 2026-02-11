// Inside your Next.js API route
import { NextApiRequest, NextApiResponse } from 'next'

const ALLOWED_HOSTNAMES = ['r2.comfy.icu']

function isAllowedUrl(input: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return false
  }

  // Only allow HTTPS
  if (parsed.protocol !== 'https:') {
    return false
  }

  // Reject explicit ports to prevent port-scanning (only allow default 443)
  if (parsed.port !== '') {
    return false
  }

  // Check against the allowlist of trusted hostnames
  return ALLOWED_HOSTNAMES.includes(parsed.hostname)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json('Invalid request body')
      }

      const { url } = req.body

      if (typeof url !== 'string' || !isAllowedUrl(url)) {
        return res.status(400).json('Invalid or disallowed URL')
      }

      const response = await fetch(url, { redirect: 'error' })
      if (!response.ok) {
        console.error(`Server responded with status: ${response.status}`)
        return res
          .status(500)
          .json('Error fetching image: Server responded with an error')
      }
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      res.setHeader('Content-Type', blob.type)
      res.send(Buffer.from(buffer))
    } catch (err: any) {
      console.error(`Error fetching image: ${err.message}`)
      res.status(500).json(`Error fetching image: ${err.message}`)
    }
  } else {
    res.status(405).json('Method not allowed')
  }
}
