import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import type { Contribution } from './api/contributions/feed'
import Container from '../components/layout/Container'
import ContentLayout from '../components/layout/ContentLayout'
import WebsiteHead from '../components/layout/Head'
import { NoticeFooter } from '../components/layout/NoticeFooter'
import { getIPFSGateway } from '@/lib/ipfs/gateway'

function ContributionFeed() {
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [citizenImages, setCitizenImages] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/contributions/feed')
      .then((r) => {
        if (!r.ok) throw new Error(`Feed request failed: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const contribs: Contribution[] = data.contributions || []
        setContributions(contribs)

        // Fetch citizen profile images for all unique wallet addresses
        const addresses = [
          ...new Set(
            contribs
              .map((c) => c.walletAddress?.trim().toLowerCase())
              .filter(Boolean)
          ),
        ]
        if (addresses.length > 0) {
          fetch(`/api/citizens/images-by-address?addresses=${addresses.join(',')}`)
            .then((r) => (r.ok ? r.json() : {}))
            .then((map) => setCitizenImages(map))
            .catch(() => {})
        }
      })
      .catch((err) => {
        console.error('[ContributionFeed]', err)
        setContributions([])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-white/40 text-sm">
        Loading contributions…
      </div>
    )
  }

  if (!contributions.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <p className="text-white/50 text-sm">No contributions have been submitted yet this quarter.</p>
        <p className="text-white/30 text-xs">Be the first — use the button above!</p>
      </div>
    )
  }

  const grouped = contributions.reduce<Record<string, Contribution[]>>((acc, c) => {
    const key = c.name || c.walletAddress || 'Anonymous'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const entries = Object.entries(grouped)

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([name, items]) => {
        const open = expanded[name]
        return (
          <div key={name} id={`contribution-${encodeURIComponent(name)}`} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all">
            <button
              type="button"
              aria-expanded={!!open}
              aria-controls={`contributions-panel-${name}`}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors gap-4"
              onClick={() => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))}
            >
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const walletKey = items[0]?.walletAddress?.trim().toLowerCase()
                  const ipfs = walletKey ? citizenImages[walletKey] : undefined
                  const imgSrc = ipfs ? getIPFSGateway(ipfs) : undefined
                  return imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={name}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {name[0]?.toUpperCase() || '?'}
                    </div>
                  )
                })()}
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{name}</p>
                  {items[0]?.area && (
                    <p className="text-blue-400 text-xs truncate">{items[0].area}</p>
                  )}
                </div>
              </div>
              <svg
                className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div id={`contributions-panel-${name}`} className="px-5 pb-5 pt-4 border-t border-white/10">
                {items.map((c) => (
                  <div key={`${c.walletAddress || 'anonymous'}:${c.timestamp}:${c.description}`}>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{c.description}</p>
                    {c.links && (
                      <a
                        href={c.links.startsWith('http') ? c.links : `https://${c.links}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs underline mt-3"
                      >
                        View supporting work ↗
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
  return (
    <>
      <WebsiteHead
        title="Community Circle"
        description="Submit your mission-aligned work and accomplishments to earn ETH financial rewards and vMOONEY voting power. Senators evaluate all submissions each quarter to distribute rewards."
      />
      <section className="flex flex-col justify-start items-start animate-fadeIn w-[90vw] md:w-full px-5 mt-5">
        <Container>
          <ContentLayout
            header="Community Circle"
            headerSize="max(20px, 3vw)"
            mainPadding
            mode="compact"
            popOverEffect={false}
            isProfile
            description={
              <>
                Did something that advances MoonDAO's mission? Submit it here. Each quarter, senators evaluate all submissions and distribute a reward pool in ETH and vMOONEY based on impact.{' '}
                <a
                  href="https://docs.moondao.com/Reference/Nested-Docs/Community-Rewards"
                  className="text-blue-400 hover:text-blue-300 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more ↗
                </a>
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
          >
            <div className="flex flex-col gap-8 max-w-[1200px] md:mb-[5vw] 2xl:mb-[2vw]">

              {/* How it works */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '01', title: 'Submit', body: 'Describe your work using the form. Any contribution that moves the mission forward counts.' },
                  { step: '02', title: 'Evaluate', body: 'Senators independently review all submissions and distribute the reward pool based on impact.' },
                  { step: '03', title: 'Get Paid', body: 'Rewards in ETH and vMOONEY are sent to your wallet at the end of each quarter.' },
                ].map(({ step, title, body }) => (
                  <div key={step} className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <p className="text-blue-400 font-GoodTimes text-xs mb-2">{step}</p>
                    <p className="text-white font-semibold text-sm mb-1">{title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              {/* Submit CTA */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-blue-900/40 to-purple-900/30 border border-blue-500/20 rounded-2xl px-6 py-5">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-1">Ready to submit?</p>
                  <p className="text-gray-400 text-xs">The form takes about 5 minutes. Submissions are reviewed at the end of each quarter.</p>
                </div>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdtHRzqDAAe1TOZ7Bp03TKVbxLFZzJeeKSUDQ-BpIZtDPxJWw/viewform"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-all duration-200 whitespace-nowrap"
                >
                  Submit a Contribution
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>

              {/* Feed */}
              <div>
                <h2 className="text-white font-GoodTimes text-xl mb-5">Recent Submissions</h2>
                <ContributionFeed />
              </div>

            </div>
          </ContentLayout>
        </Container>
      </section>
    </>
  )
}



