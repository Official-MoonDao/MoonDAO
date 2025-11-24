import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface TownHallSummary {
  id: string
  title: string
  content: string
  publishedAt: string
  url?: string
  createdAt: string
}

interface TownHallSummaryCardProps {
  summary: TownHallSummary
}

export default function TownHallSummaryCard({ summary }: TownHallSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const publishedDate = new Date(summary.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const previewContent = summary.content
    .replace(/<[^>]*>/g, '')
    .substring(0, 200)
    .trim() + '...'

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/70 transition-all duration-200">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">{summary.title}</h3>
            <p className="text-sm text-slate-400">{publishedDate}</p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-white transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {!isExpanded ? (
          <div className="text-slate-300 leading-relaxed">
            <p>{previewContent}</p>
          </div>
        ) : (
          <div
            className="prose prose-invert max-w-none text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: summary.content }}
          />
        )}

        <div className="flex items-center gap-4 pt-2 border-t border-slate-700/50">
          {summary.url && (
            <Link
              href={summary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View on ConvertKit →
            </Link>
          )}
          <Link
            href={`https://youtube.com/@officialmoondao`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            Watch on YouTube →
          </Link>
        </div>
      </div>
    </div>
  )
}

