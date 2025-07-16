import { getOnrampBuyUrl } from '@coinbase/onchainkit/fund'
import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { address, amount, redirectUrl } = req.body

    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' })
    }

    const projectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID
    if (!projectId) {
      return res.status(500).json({ error: 'CDP_PROJECT_ID not configured' })
    }

    const onrampUrl = getOnrampBuyUrl({
      projectId,
      addresses: { [address]: ['ethereum'] },
      assets: ['ETH'],
      presetFiatAmount: amount || 20,
      fiatCurrency: 'USD',
      redirectUrl: redirectUrl || `${req.headers.origin}/`,
    })

    res.status(200).json({ onrampUrl })
  } catch (error) {
    console.error('Error generating onramp URL:', error)
    res.status(500).json({ error: 'Failed to generate onramp URL' })
  }
}
