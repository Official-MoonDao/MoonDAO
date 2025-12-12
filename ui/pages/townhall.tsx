import { ChatBubbleLeftRightIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import type { GetStaticProps } from 'next'
import { useState, useEffect } from 'react'
import { getSummaries, type TownHallSummary } from '../lib/townhall/summaries'
import WebsiteHead from '../components/layout/Head'
import { LoadingSpinner } from '../components/layout/LoadingSpinner'
import Search from '../components/layout/Search'
import Tooltip from '../components/layout/Tooltip'
import NextTownHall from '../components/townhall/NextTownHall'
import TownHallSummaryCard from '../components/townhall/TownHallSummaryCard'
import TownhallSocials from '../components/townhall/TownhallSocials'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

interface TownHallProps {
  initialSummaries: TownHallSummary[]
  total: number
}

const PAGE_SIZE = 5

export default function TownHall({ initialSummaries, total }: TownHallProps) {
  const [summaries, setSummaries] = useState<TownHallSummary[]>(initialSummaries)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(initialSummaries.length < total)
  const [searchInput, setSearchInput] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<TownHallSummary[]>([])
  const [isSearchMode, setIsSearchMode] = useState(false)

  const displayedSummaries = isSearchMode ? searchResults : summaries

  useEffect(() => {
    const searchTerm = searchInput.trim()

    if (!searchTerm) {
      setIsSearchMode(false)
      setSearchResults([])
      return
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setSearchLoading(true)
        setError(null)
        const response = await fetch(
          `/api/townhall/summaries?limit=100&offset=0&search=${encodeURIComponent(searchTerm)}`
        )
        if (!response.ok) {
          throw new Error('Failed to search summaries')
        }
        const data = await response.json()
        setSearchResults(data.summaries)
        setIsSearchMode(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search summaries')
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchInput])

  const loadMore = async () => {
    if (loading || !hasMore) return

    try {
      setLoading(true)
      setError(null)
      const offset = summaries.length
      const response = await fetch(`/api/townhall/summaries?limit=${PAGE_SIZE}&offset=${offset}`)
      if (!response.ok) {
        throw new Error('Failed to fetch summaries')
      }
      const data = await response.json()
      const newSummaries = [...summaries, ...data.summaries]
      setSummaries(newSummaries)
      setHasMore(data.summaries.length === PAGE_SIZE && newSummaries.length < total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summaries')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <WebsiteHead
        title="Town Hall"
        description="Weekly Town Hall meetings with key topics, decisions, and action items for the MoonDAO community."
        image="/assets/townhall-metadata.png"
      />
      <div className="min-h-screen relative">
        {/* Main content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {/* Header section */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-GoodTimes text-white mb-4 leading-tight">
              Town Hall
            </h1>
            <p className="text-lg md:text-xl text-slate-200 max-w-3xl leading-relaxed mb-6">
              Weekly Town Hall meetings with key topics discussed, decisions made, action items, and
              important updates for community members.
            </p>

            {/* Enhanced info section */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 mb-6 shadow-xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-blue-400/30">
                    <VideoCameraIcon className="w-6 h-6 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">What We Do</h3>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      Town halls are weekly community meetings where we discuss proposals, make
                      decisions, share updates, and coordinate on projects. All community members
                      are welcome to participate and contribute.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-purple-400/30">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Join Live</h3>
                    <p className="text-slate-200 text-sm leading-relaxed mb-4">
                      Town halls are streamed live to LinkedIn, YouTube, and X. Join us on Discord
                      to watch the YouTube stream together with the community. You can ask questions
                      in the chat on any platform, and the team will respond during the stream.
                    </p>
                    <TownhallSocials />
                  </div>
                </div>
              </div>
            </div>

            {/* Next Town Hall section */}
            <NextTownHall />

            {/* Search bar */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 shadow-xl hover:border-slate-600/70 hover:bg-slate-900/50 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Search
                    input={searchInput}
                    setInput={setSearchInput}
                    placeholder="Search town halls by topic, keyword, or content..."
                    className="w-full"
                  />
                </div>
                <Tooltip
                  text='Advanced Search: Use quotes for exact matches ("June"), OR for alternatives (budget OR funding), NOT to exclude (-spam), AND for multiple terms (default). Examples: "town hall" OR meeting, budget AND -rejected'
                  compact={true}
                >
                  ?
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Summaries list */}
          <div className="space-y-6">
            {searchLoading ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner width="w-8" height="h-8" />
                <span className="ml-3 text-slate-200">Searching...</span>
              </div>
            ) : error && summaries.length === 0 ? (
              <div className="bg-red-900/30 backdrop-blur-md border border-red-700/50 rounded-2xl p-6 text-red-200 shadow-xl">
                <p className="font-semibold mb-2">Error loading summaries</p>
                <p>{error}</p>
              </div>
            ) : summaries.length === 0 ? (
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 text-slate-200 shadow-xl">
                <p>No town hall summaries available yet. Check back soon!</p>
              </div>
            ) : displayedSummaries.length === 0 && isSearchMode ? (
              <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 text-slate-200 shadow-xl">
                <p className="font-semibold mb-2">No results found</p>
                <p>Try adjusting your search to find what you're looking for.</p>
              </div>
            ) : (
              <>
                {isSearchMode && (
                  <div className="text-slate-300 text-sm mb-4">
                    Found {displayedSummaries.length}{' '}
                    {displayedSummaries.length === 1 ? 'result' : 'results'}
                  </div>
                )}
                {error && !searchLoading && (
                  <div className="bg-red-900/30 backdrop-blur-md border border-red-700/50 rounded-2xl p-6 text-red-200 shadow-xl">
                    <p className="font-semibold mb-2">Error loading summaries</p>
                    <p>{error}</p>
                  </div>
                )}
                {displayedSummaries.map((summary, index) => (
                  <TownHallSummaryCard
                    key={summary.id}
                    summary={summary}
                    isFeatured={!isSearchMode && index === 0}
                  />
                ))}
                {hasMore && !isSearchMode && (
                  <div className="flex justify-center pt-8">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-blue-800 disabled:to-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <LoadingSpinner width="w-4" height="h-4" />
                          Loading...
                        </span>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Info banner */}
          <div className="bg-blue-900/30 backdrop-blur-md border border-blue-700/50 rounded-xl p-4 mt-12 shadow-xl">
            <p className="text-sm text-blue-200 text-left">
              We're working on improving our AI summaries. Some summaries may contain spelling or
              formatting errors and may be retroactively regenerated or edited for better quality.
            </p>
          </div>
        </div>
        <NoticeFooter />
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps<TownHallProps> = async () => {
  try {
    const result = await getSummaries({ limit: PAGE_SIZE, offset: 0 })

    return {
      props: {
        initialSummaries: result.summaries,
        total: result.total,
      },
      revalidate: 60,
    }
  } catch (error) {
    console.error('Error in getStaticProps for townhall:', error)
    return {
      props: {
        initialSummaries: [],
        total: 0,
      },
      revalidate: 60,
    }
  }
}
