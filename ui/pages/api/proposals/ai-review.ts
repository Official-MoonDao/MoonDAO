import { MAX_BUDGET_USD } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { performGroqReview } from '@/lib/proposals/aiReview'

const MAX_BODY_CHARS = 80_000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'AI review is not configured (missing GROQ_API_KEY).' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const proposalBody = typeof body?.body === 'string' ? body.body.trim() : ''
  const budgetHintUsd =
    typeof body?.budgetHintUsd === 'number' && Number.isFinite(body.budgetHintUsd)
      ? body.budgetHintUsd
      : null

  if (!title) {
    return res.status(400).json({ error: 'Proposal title is required.' })
  }
  if (!proposalBody) {
    return res.status(400).json({ error: 'Proposal body is required.' })
  }
  if (proposalBody.length > MAX_BODY_CHARS) {
    return res.status(400).json({
      error: `Proposal body is too long for AI review (max ${MAX_BODY_CHARS} characters).`,
    })
  }

  const quarterlyMaxUsd = MAX_BUDGET_USD

  const outcome = await performGroqReview({
    title,
    body: proposalBody,
    quarterlyMaxUsd,
    budgetHintUsd,
    apiKey: process.env.GROQ_API_KEY,
  })

  if (!outcome.ok) {
    return res.status(outcome.status).json({ error: outcome.error })
  }

  return res.status(200).json({
    review: outcome.review,
    quarterlyMaxUsd,
  })
}

export default withMiddleware(handler, rateLimit)
