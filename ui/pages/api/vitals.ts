import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const data = req.body

    // Log web vitals in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals API]', {
        name: data.name,
        value: data.value,
        rating: data.rating,
        url: data.url,
      })
    }

    // Here you would typically send to your analytics service
    // Examples: Google Analytics, Vercel Analytics, Custom Analytics
    
    // For now, just log and return success
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Web Vitals API] Error:', error)
    res.status(500).json({ success: false })
  }
}

