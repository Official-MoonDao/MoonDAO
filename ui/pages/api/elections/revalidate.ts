import { NextApiRequest, NextApiResponse } from 'next'
import {
  electionPhase,
  getElection,
  listBuildableElections,
  pagesShowingElection,
} from '@/lib/elections/elections'

// Public, so voters see their ballot in the list right away instead of
// waiting out the 60s ISR window. Limited to open elections and throttled
// per slug so it can't be used to hammer page regeneration.
const MIN_INTERVAL_MS = 5_000
const lastRun = new Map<string, number>()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const slug = typeof req.body?.slug === 'string' ? req.body.slug : ''
  const election = getElection(slug)
  if (!election || !listBuildableElections().includes(election)) {
    return res.status(404).json({ message: 'Unknown election' })
  }
  if (electionPhase(election) !== 'open') {
    return res.status(400).json({ message: 'Election is not open' })
  }

  const now = Date.now()
  if (now - (lastRun.get(slug) ?? 0) < MIN_INTERVAL_MS) {
    return res.status(429).json({ message: 'Try again shortly' })
  }
  lastRun.set(slug, now)

  try {
    await Promise.all(pagesShowingElection(slug).map((s) => res.revalidate(`/elections/${s}`)))
    return res.json({ revalidated: true })
  } catch {
    return res.status(500).json({ message: 'Error revalidating' })
  }
}
