// Inside your Next.js API route
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const { url } = req.body
      const response = await fetch(url)
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
