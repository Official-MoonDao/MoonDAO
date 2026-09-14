import type { NextApiRequest, NextApiResponse } from 'next'
import { authorizeCronRequest, cronSecretFromRequest } from '@/lib/deprize/reconcile'
import { runDePrizeReconcile } from '@/lib/deprize/runReconcile'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const auth = authorizeCronRequest({
    production: process.env.NEXT_PUBLIC_ENV === 'prod',
    expectedSecret: process.env.CRON_SECRET,
    providedSecret: cronSecretFromRequest(req),
  })
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message })
  }

  try {
    const result = await runDePrizeReconcile()
    return res.status(result.ok ? 200 : 500).json(result)
  } catch (error) {
    console.error('[cron/deprize-reconcile]', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
