import { useState } from 'react'
import type { ProposalAIReviewResult, ProvisionalVote } from '@/lib/proposals/aiReview'

type Props = {
  title?: string
  body?: string
  budgetHintUsd?: number
  disabled?: boolean
  onReview?: (review: ProposalAIReviewResult) => void
}

function voteStyles(vote: ProvisionalVote): string {
  switch (vote) {
    case 'Approve':
      return 'bg-green-500/20 text-green-300 border-green-500/40'
    case 'Approve with conditions':
      return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40'
    case 'Request rewrite':
      return 'bg-orange-500/20 text-orange-200 border-orange-500/40'
    case 'Reject':
      return 'bg-red-500/20 text-red-300 border-red-500/40'
    default:
      return 'bg-white/10 text-gray-200 border-white/20'
  }
}

function scoreColor(score: number): string {
  if (score <= 3) return 'text-red-400'
  if (score <= 5) return 'text-orange-300'
  if (score <= 7) return 'text-yellow-200'
  return 'text-green-300'
}

export default function ProposalAIReview({
  title,
  body,
  budgetHintUsd,
  disabled,
  onReview,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [review, setReview] = useState<ProposalAIReviewResult | undefined>()
  const [quarterlyMaxUsd, setQuarterlyMaxUsd] = useState<number | undefined>()

  async function runReview() {
    setError(undefined)
    if (!title?.trim()) {
      setError('Add a proposal title before running AI review.')
      return
    }
    if (!body?.trim()) {
      setError('Import your proposal body before running AI review.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/proposals/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          budgetHintUsd: budgetHintUsd && budgetHintUsd > 0 ? budgetHintUsd : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'AI review failed.')
      }
      setReview(data.review)
      setQuarterlyMaxUsd(data.quarterlyMaxUsd)
      onReview?.(data.review)
    } catch (e: any) {
      setError(e?.message || 'AI review failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 md:mt-5 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-white font-medium">AI Senate-style Review</h3>
          <p className="text-xs text-gray-400 mt-1">
            Advisory only — scores your draft against the Senate rubric before you submit.
          </p>
        </div>
        <button
          type="button"
          onClick={runReview}
          disabled={disabled || loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Reviewing…' : review ? 'Re-run AI Review' : 'Get AI Review'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!review && !error && !loading && (
          <p className="text-sm text-gray-400">
            Run a quick check for budget cap, Novelty &amp; Prior Art, hard flags, and rewrite risk
            before Senate discussion.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <svg
              className="animate-spin h-4 w-4 text-indigo-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Scoring against Mission, Team, Objectives, Budget, Impact, Feasibility,
            Accountability, Fiduciary…
          </div>
        )}

        {review && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-lg border text-sm font-medium ${voteStyles(
                  review.provisionalVote
                )}`}
              >
                {review.provisionalVote}
              </span>
              <span className="text-sm text-gray-300">
                Avg <span className={`font-semibold ${scoreColor(review.average)}`}>{review.average}</span>
                /10
              </span>
              {review.askUsd != null && (
                <span className="text-sm text-gray-400">
                  Ask ${Math.round(review.askUsd).toLocaleString()}
                  {quarterlyMaxUsd != null && (
                    <>
                      {' '}
                      · max ${quarterlyMaxUsd.toLocaleString()}
                      {review.askWithinMax === false && (
                        <span className="text-red-400"> (over)</span>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">{review.finding}</p>

            {review.hardFlags.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide text-red-300 mb-2">Hard flags</h4>
                <ul className="space-y-1">
                  {review.hardFlags.map((flag) => (
                    <li key={flag} className="text-sm text-red-200/90 flex gap-2">
                      <span className="text-red-400">•</span>
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {review.topIssues.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide text-yellow-200/80 mb-2">
                  Top fixes
                </h4>
                <ol className="list-decimal list-inside space-y-1">
                  {review.topIssues.map((issue) => (
                    <li key={issue} className="text-sm text-gray-300">
                      {issue}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {review.conditions.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wide text-indigo-200/80 mb-2">
                  Conditions
                </h4>
                <ul className="space-y-1">
                  {review.conditions.map((c) => (
                    <li key={c} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-indigo-300">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {review.dimensions.map((d) => (
                <div
                  key={d.key}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-400">{d.label}</span>
                    <span className={`text-sm font-semibold ${scoreColor(d.score)}`}>
                      {d.score}/10
                    </span>
                  </div>
                  {d.note && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.note}</p>}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500">
              Advisory preview via {review.model}. Senate vote is independent.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
