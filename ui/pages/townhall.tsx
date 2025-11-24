import { useState, useEffect } from 'react'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import TownHallSummaryCard from '../components/townhall/TownHallSummaryCard'
import { LoadingSpinner } from '../components/layout/LoadingSpinner'

interface TownHallSummary {
  id: string
  title: string
  content: string
  publishedAt: string
  url?: string
  createdAt: string
}

export default function TownHall() {
  const [summaries, setSummaries] = useState<TownHallSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/townhall/summaries')
        if (!response.ok) {
          throw new Error('Failed to fetch summaries')
        }
        const data = await response.json()
        setSummaries(data.summaries || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load summaries')
      } finally {
        setLoading(false)
      }
    }

    fetchSummaries()
  }, [])

  return (
    <>
      <WebsiteHead
        title="Town Hall Summaries"
        description="Weekly Town Hall summaries with key topics, decisions, and action items for the MoonDAO community."
      />
      <section className="w-[calc(100vw-20px)]">
        <Container>
          <ContentLayout
            header="Town Hall Summaries"
            headerSize="max(20px, 3vw)"
            description={
              <>
                Weekly summaries of our Town Hall meetings, automatically generated
                from transcripts. Each summary includes key topics discussed,
                decisions made, action items, and important updates for community
                members.
              </>
            }
            preFooter={
              <NoticeFooter
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Need Help?"
                defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
                defaultButtonText="Submit a Ticket"
                defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
                imageWidth={200}
                imageHeight={200}
              />
            }
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
          >
            <div className="mt-10 mb-10">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <LoadingSpinner width="w-12" height="h-12" />
                </div>
              ) : error ? (
                <div className="bg-red-900/20 border border-red-700/50 rounded-2xl p-6 text-red-300">
                  <p className="font-semibold mb-2">Error loading summaries</p>
                  <p>{error}</p>
                </div>
              ) : summaries.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-slate-300">
                  <p>No town hall summaries available yet. Check back soon!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {summaries.map((summary) => (
                    <TownHallSummaryCard key={summary.id} summary={summary} />
                  ))}
                </div>
              )}
            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}

