import { MAX_BUDGET_USD } from 'const/config'
import { rateLimit } from 'middleware/rateLimit'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  AI_REVIEW_MODEL,
  buildReviewSystemPrompt,
  buildReviewUserPrompt,
  extractJsonObject,
  normalizeReviewResult,
  ProposalAIReviewResult,
} from '@/lib/proposals/aiReview'

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

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_REVIEW_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildReviewSystemPrompt(quarterlyMaxUsd) },
          {
            role: 'user',
            content: buildReviewUserPrompt({
              title,
              body: proposalBody,
              quarterlyMaxUsd,
              budgetHintUsd,
            }),
          },
        ],
      }),
    })

    const data = await groqRes.json()
    if (!groqRes.ok) {
      console.error('Groq AI review failed:', data)
      return res.status(502).json({
        error: data?.error?.message || 'AI review provider returned an error.',
      })
    }

    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) {
      return res.status(502).json({ error: 'AI review returned an empty response.' })
    }

    let parsed: unknown
    try {
      parsed = extractJsonObject(text)
    } catch (e) {
      console.error('Failed to parse AI review JSON:', text)
      return res.status(502).json({ error: 'AI review returned invalid JSON.' })
    }

    const review: ProposalAIReviewResult = normalizeReviewResult({
      raw: parsed,
      body: proposalBody,
      quarterlyMaxUsd,
      budgetHintUsd,
      model: AI_REVIEW_MODEL,
    })

    return res.status(200).json({
      review,
      quarterlyMaxUsd,
    })
  } catch (error: any) {
    console.error('AI review error:', error)
    return res.status(500).json({ error: error?.message || 'AI review failed.' })
  }
}

export default withMiddleware(handler, rateLimit)
