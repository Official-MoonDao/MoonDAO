import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { cleanSummaryContent, getPreviewText } from '../../lib/townhall/utils'
import YouTubeEmbed from './YouTubeEmbed'

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
  isFeatured?: boolean
}

export default function TownHallSummaryCard({
  summary,
  isFeatured = false,
}: TownHallSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(isFeatured)

  useEffect(() => {
    if (isFeatured) {
      setIsExpanded(true)
    }
  }, [isFeatured])

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
      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-2xl p-6 lg:p-8 hover:border-slate-600/70 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer group overflow-hidden"
    >
      <div className="flex flex-col gap-6">
        {/* Header section */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">
              {summary.title}
            </h3>
            <p className="text-sm text-slate-400 mb-3">
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
            <div className="space-y-6">
              {/* YouTube embed when expanded */}
              {summary.videoId && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="-mx-6 lg:mx-0 mb-4 lg:mb-0 px-2 lg:px-0"
                >
                  <YouTubeEmbed videoId={summary.videoId} className="w-full" />
                </div>
              )}
              {/* Summary content */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
