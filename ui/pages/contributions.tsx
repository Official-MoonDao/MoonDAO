import React, { useEffect, useState } from 'react'
import type { Contribution } from './api/contributions/feed'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'

function ContributionFeed() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetch('/api/contributions/feed')
      .then((r) => r.json())
      .then((data) => setContributions(data.contributions || []))
      .catch(() => setContributions([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-white/40 text-sm">
        Loading recent contributions…
      </div>
    )
  }

  if (!contributions.length) {
    return (
      <div className="mt-10">
        <h3 className="text-white font-GoodTimes text-lg mb-4">Recent Contributions</h3>
        <div className="flex flex-col items-center justify-center py-10 bg-black/20 border border-white/10 rounded-xl text-center gap-2">
          <p className="text-white/50 text-sm">No contributions have been submitted yet this quarter.</p>
          <p className="text-white/30 text-xs">Be the first — submit your work using the button above!</p>
        </div>
      </div>
    )
  }

  // Group by submitter name / wallet
  const grouped = contributions.reduce<Record<string, Contribution[]>>((acc, c) => {
    const key = c.name || c.walletAddress || 'Anonymous'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const entries = Object.entries(grouped)

  return (
    <div className="mt-10 flex flex-col gap-4">
      <h3 className="text-white font-GoodTimes text-lg">Recent Contributions</h3>
      {entries.map(([name, items], idx) => {
        const open = expanded[idx]
        return (
          <div
            key={idx}
            className="bg-black/20 border border-white/10 rounded-xl overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
              onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {name[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-white font-medium truncate">{name}</span>
              </div>
              <svg
                className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="border-t border-white/10 divide-y divide-white/5">
                {items.map((c, cidx) => (
                  <div key={cidx} className="px-5 py-4">
                    {c.quarter && (
                      <span className="text-xs text-blue-400 font-medium mb-1 block">{c.quarter}</span>
                    )}
                    <p className="text-gray-300 text-sm leading-relaxed">{c.description}</p>
                    {c.links && (
                      <a
                        href={c.links.startsWith('http') ? c.links : `https://${c.links}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs underline mt-2 block truncate"
                      >
                        {c.links}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ContributionsPage() {
  const title = 'Submit Your Contribution'

  return (
    <>
      <WebsiteHead 
        title={title} 
        description="Submit your mission-aligned work and accomplishments to earn ETH financial rewards and vMOONEY voting power. Senators evaluate all submissions each quarter to distribute rewards." 
      />
      <section className="flex flex-col justify-start px-5 mt-5 items-start animate-fadeIn w-[90vw] md:w-full">
        <Container>
          <ContentLayout
            header="Submit Your Contribution"
            headerSize="40px"
            description={
              <div className="text-gray-300 text-lg leading-relaxed">
                Submit your contributions to participate in MoonDAO's quarterly retroactive rewards cycle. MoonDAO senators evaluate all submissions and distribute rewards based on impact. Rewards in ETH and vMOONEY are paid out from a community pool each quarter.
              </div>
            }
            mainPadding
            mode="compact"
            isProfile={true}
          >
            <div className="flex flex-col gap-6 p-6 md:p-8 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">
              <div className="mb-8 flex flex-col items-center bg-black/20 rounded-xl p-6 border border-white/10">
                <h3 className="text-white font-GoodTimes text-lg mb-4 text-center">How Community Rewards Work</h3>
                <p className="text-gray-300 leading-relaxed text-center mb-3">
                  MoonDAO runs quarterly retroactive reward cycles. Submit any work that advances our mission to establish a lunar settlement—directly tied to MoonDAO or not, if it accelerates our multiplanetary future, it counts!
                </p>
                <p className="text-gray-300 leading-relaxed text-center mb-3">
                  Each quarter, MoonDAO senators independently evaluate all submitted contributions and distribute a shared reward pool (funded with ETH and vMOONEY) based on impact. Higher-impact contributions receive a larger share of the pool.
                </p>
                <p className="text-gray-300 leading-relaxed text-center">
                  Learn more in{' '}
                  <a
                    href="https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards"
                    className="text-blue-400 hover:text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    our Community Rewards documentation
                  </a>.
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="text-gray-400 text-center text-sm">
                  Click below to open the contribution submission form.
                </p>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdtHRzqDAAe1TOZ7Bp03TKVbxLFZzJeeKSUDQ-BpIZtDPxJWw/viewform"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-GoodTimes text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]"
                >
                  Submit a Contribution
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
              <ContributionFeed />
            </div>
          </ContentLayout>
          <NoticeFooter 
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Need Help?"
            defaultDescription="Submit a ticket in the support channel on MoonDAO's Discord!"
            defaultButtonText="Submit a Ticket"
            defaultButtonLink="https://discord.com/channels/914720248140279868/1212113005836247050"
            imageWidth={200}
            imageHeight={200}
          />
        </Container>
      </section>
    </>
  )
}
