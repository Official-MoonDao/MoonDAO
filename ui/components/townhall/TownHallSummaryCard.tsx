import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState } from 'react'
import { cleanSummaryContent, getPreviewText } from '../../lib/townhall/utils'

interface TownHallSummary {
  id: string
  title: string
  content: string
  publishedAt: string
  url?: string
  createdAt: string
  videoId?: string
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

  const cleanedContent = cleanSummaryContent(summary.content)
  const previewContent = getPreviewText(cleanedContent, 200)

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't expand if clicking on links
    const target = e.target as HTMLElement
    if (target.tagName === 'A' || target.closest('a')) {
      return
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <div
      onClick={handleCardClick}
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-6 lg:p-8 hover:border-slate-600/70 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex flex-col gap-6">
        {/* Header section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
              {summary.title}
            </h3>
            <p className="text-sm text-slate-400">
              <span className="text-slate-500">Published:</span> {publishedDate}
            </p>
          </div>
          <div className="flex-shrink-0 p-2 text-slate-400 group-hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronUpIcon className="w-6 h-6" />
            ) : (
              <ChevronDownIcon className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Content section */}
        <div className="transition-all duration-300">
          {!isExpanded ? (
            <div className="text-slate-300 leading-relaxed">
              <p className="line-clamp-3">{previewContent}</p>
            </div>
          ) : (
            <div
              className="prose prose-invert prose-lg max-w-none text-slate-300 leading-relaxed
                prose-headings:text-white prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4
                prose-h2:text-xl prose-h2:font-GoodTimes prose-h2:text-blue-300
                prose-h3:text-lg prose-h3:font-semibold prose-h3:text-slate-200
                prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
                prose-ul:text-slate-300 prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
                prose-li:mb-2 prose-li:leading-relaxed
                prose-strong:text-white prose-strong:font-semibold
                prose-a:text-blue-400 prose-a:hover:text-blue-300 prose-a:no-underline hover:prose-a:underline
                prose-hr:border-slate-700 prose-hr:my-8"
              dangerouslySetInnerHTML={{ __html: cleanedContent }}
            />
          )}
        </div>

        {/* Footer with YouTube link */}
        {isExpanded && summary.videoId && (
          <div className="pt-4 border-t border-slate-700/50">
            <Link
              href={`https://youtube.com/watch?v=${summary.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 font-medium transition-colors group/link"
            >
              <svg
                className="w-5 h-5 group-hover/link:scale-110 transition-transform"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              <span>Watch on YouTube</span>
              <svg
                className="w-4 h-4 group-hover/link:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
