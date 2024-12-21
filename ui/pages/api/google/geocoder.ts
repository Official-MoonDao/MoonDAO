import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { location } = req.body
    try {
      const locationRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${location}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      )
      const locationData = await locationRes.json()
      return res.send({ data: locationData })
    } catch (error) {
      console.error('Error processing request:', error)
      return res.status(500).json('Error processing request')
    }
  } else {
    return res.status(400).json('Invalid method')
  }
}

export default withMiddleware(handler, authMiddleware)
