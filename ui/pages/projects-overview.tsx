import {
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  MAX_BUDGET_USD,
  BASE_ASSETS_URL,
  PROJECT_SYSTEM_CONFIG,
  NEXT_QUARTER_BUDGET_USD,
} from 'const/config'
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import React, { useMemo, useEffect, useState } from 'react'
import { useAssets } from '@/lib/dashboard/hooks'
import { enrichProjectNames } from '@/lib/project/enrichProjectNames'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import { getRelativeQuarter } from '@/lib/utils/dates'
import { getBudget } from '@/lib/utils/rewards'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import DashboardActiveProjects from '@/components/project/DashboardActiveProjects'
import { PROJECT_ACTIVE, PROJECT_ENDED } from '@/lib/nance/types'

const STEPS = [
  {
    n: '01',
    title: 'Ideate',
    body: 'Share the problem and draft solution in Discord. Get feedback before you lock a budget.',
  },
  {
    n: '02',
    title: 'Propose',
    body: 'Fill the template—novelty, lunar bridge, SMART key results, and a work-only budget under the max.',
  },
  {
    n: '03',
    title: 'Present & vote',
    body: 'Pitch at Town Hall. Senate diligence, then member vote. Funded leads join the Senate for the project.',
  },
  {
    n: '04',
    title: 'Ship & rewards',
    body: 'Weekly updates, final report, return unused funds. Completed work can earn quarterly retroactive rewards.',
  },
]

const FUND_YES = [
  'Labor tied to inspectable deliverables',
  'Specialized gear the work uniquely needs (with ownership/access terms)',
  'Open reports, protocols, software, and member-usable tools',
]

const FUND_NO = [
  'General computers, monitors, printers, or home-office setup',
  'LLC / sole-prop formation or company registration fees',
  'Tax bills, re-registration, or private runway bailouts',
]

const CHECKLIST = [
  'Ask ≤ quarterly max',
  'Novelty & Prior Art with citations',
  'Explicit lunar bridge',
  'Non-empty SMART key results',
  'Budget classes A–E (C/D = $0)',
  'IP disclosed (open or retained)',
  'One primary ask per Lead this quarter',
  'Same-type prior work linked',
]

const ProjectsOverview: React.FC<{
  currentProjects: Project[]
  pastProjects: Project[]
  distributions: any[]
}> = ({ currentProjects }) => {
  const title = 'MoonDAO Project System'
  const description =
    "Fund mission-aligned work that advances a permanent lunar settlement. See this quarter's max budget, what we fund, and how to submit a strong proposal."

  const { quarter, year } = getRelativeQuarter(0)

  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth } = useStakedEth()

  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState<number | null>(null)
  const [isLoadingMooneyUSD, setIsLoadingMooneyUSD] = useState(true)

  const tokens = useMemo(() => {
    return mainnetTokens
      .concat(arbitrumTokens)
      .concat(polygonTokens)
      .concat(baseTokens)
      .filter((token: any) => token.usd > 1)
      .concat([{ symbol: 'stETH', balance: stakedEth }])
  }, [mainnetTokens, arbitrumTokens, polygonTokens, baseTokens, stakedEth])

  const { mooneyBudget } = useMemo(() => getBudget(tokens, year, quarter), [tokens, year, quarter])

  const usdBudget = NEXT_QUARTER_BUDGET_USD

  useEffect(() => {
    let isCancelled = false

    async function getMooneyBudgetUSD() {
      try {
        if (!mooneyBudget || mooneyBudget < 0.01) {
          setMooneyBudgetUSD(0)
          setIsLoadingMooneyUSD(false)
          return
        }

        const response = await fetch('/api/mooney/price')
        if (!response.ok) throw new Error('Failed to fetch MOONEY price')

        const data = await response.json()
        const mooneyPriceUSD = data.result?.price || 0

        if (!isCancelled && mooneyPriceUSD > 0) {
          setMooneyBudgetUSD(mooneyBudget * mooneyPriceUSD)
        }
        if (!isCancelled) setIsLoadingMooneyUSD(false)
      } catch (error) {
        console.error('Error fetching Mooney budget USD:', error)
        if (!isCancelled) {
          setMooneyBudgetUSD(0)
          setIsLoadingMooneyUSD(false)
        }
      }
    }

    if (mooneyBudget) {
      getMooneyBudgetUSD()
    } else if (mooneyBudget === 0) {
      setIsLoadingMooneyUSD(false)
    }

    return () => {
      isCancelled = true
    }
  }, [mooneyBudget])

  return (
    <>
      <WebsiteHead title={title} description={description} image="/assets/moondao-og.jpg" />

      {/* Hero — one composition */}
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#010208]">
        <Image
          src="/assets/projects-hero.png"
          alt=""
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/70 via-[#010208]/35 to-[#010208]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(56,120,220,0.22),transparent_55%)]" />

        <Container>
          <div className="relative z-10 flex min-h-[100svh] flex-col justify-center px-4 py-28 md:px-8">
            <p className="mb-4 font-GoodTimes text-xs tracking-[0.35em] text-white/70 md:text-sm">
              MOONDAO
            </p>
            <h1 className="max-w-4xl font-GoodTimes text-4xl leading-tight text-white md:text-6xl lg:text-7xl">
              Project System
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85 md:text-xl">
              Quarterly grants for work that moves a self-sustaining lunar settlement forward—open
              tools, research, and hardware, not company setup.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <StandardButton
                className="!px-6 !py-3"
                backgroundColor="bg-white"
                textColor="text-black"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/propose"
              >
                Submit a proposal
              </StandardButton>
              <StandardButton
                className="!px-6 !py-3 border border-white/25"
                backgroundColor="bg-transparent"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/proposal-template"
              >
                View template
              </StandardButton>
            </div>
          </div>
        </Container>
      </section>

      {/* Quarter facts */}
      <section className="border-y border-white/10 bg-[#060a14] px-4 py-10 md:px-8">
        <Container>
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm text-white/50">Max per project · Q{quarter} {year}</p>
              <p className="mt-1 font-GoodTimes text-3xl text-white md:text-4xl">
                ${MAX_BUDGET_USD.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-white/45">1/5 of quarterly project budget</p>
            </div>
            <div>
              <p className="text-sm text-white/50">Submission deadline</p>
              <p className="mt-1 font-GoodTimes text-2xl text-white md:text-3xl">
                {PROJECT_SYSTEM_CONFIG.submissionDeadline}
              </p>
              <p className="mt-1 text-sm text-white/45">2nd Thursday of the quarter</p>
            </div>
            <div>
              <p className="text-sm text-white/50">Member voting</p>
              <p className="mt-1 font-GoodTimes text-2xl text-white md:text-3xl">
                {PROJECT_SYSTEM_CONFIG.votingDate}
              </p>
              <p className="mt-1 text-sm text-white/45">After Town Hall presentations</p>
            </div>
          </div>
        </Container>
      </section>

      {/* What we fund */}
      <section className="px-4 py-16 md:px-8 md:py-24">
        <Container>
          <div className="mx-auto max-w-6xl">
            <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">What we fund</h2>
            <p className="mt-4 max-w-2xl text-lg text-gray-300">
              MoonDAO pays for mission outputs and specialized tools that work uniquely needs. We do
              not subsidize private company setup or baseline personal computing.
            </p>

            <div className="mt-10 grid gap-8 md:grid-cols-2">
              <div className="border-l-2 border-cyan-400/60 pl-6">
                <h3 className="font-GoodTimes text-lg text-cyan-200">Fund</h3>
                <ul className="mt-4 space-y-3 text-gray-300">
                  {FUND_YES.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-l-2 border-white/20 pl-6">
                <h3 className="font-GoodTimes text-lg text-white/70">Do not fund</h3>
                <ul className="mt-4 space-y-3 text-gray-400">
                  {FUND_NO.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-[#060a14] px-4 py-16 md:px-8 md:py-24">
        <Container>
          <div className="mx-auto max-w-6xl">
            <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">How it works</h2>
            <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <p className="font-GoodTimes text-sm tracking-widest text-blue-300/70">{step.n}</p>
                  <h3 className="mt-2 font-GoodTimes text-xl text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Rewards + checklist */}
      <section className="px-4 py-16 md:px-8 md:py-24">
        <Container>
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
            <div>
              <h2 className="font-GoodTimes text-3xl text-white">This quarter&apos;s pool</h2>
              <p className="mt-4 text-gray-300">
                Retroactive rewards for completed projects sit alongside proposal budgets. Proposal
                asks must stay at or under the per-project max above.
              </p>
              <div className="mt-8 space-y-6">
                <div>
                  <p className="text-sm text-white/50">Stablecoin retro pool</p>
                  <p className="font-GoodTimes text-3xl text-white">
                    ${NEXT_QUARTER_BUDGET_USD.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/50">vMOONEY retro pool</p>
                  <p className="font-GoodTimes text-2xl text-white">
                    {mooneyBudget > 0 ? (
                      <>
                        {Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                        <span className="ml-2 text-base font-sans text-white/50">
                          {isLoadingMooneyUSD
                            ? '…'
                            : mooneyBudgetUSD && mooneyBudgetUSD > 0
                              ? `(~$${mooneyBudgetUSD.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })})`
                              : null}
                        </span>
                      </>
                    ) : (
                      '…'
                    )}
                  </p>
                  <p className="mt-1 text-sm text-white/40">Locked 4 years as delegated vMOONEY</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-GoodTimes text-3xl text-white">Before you submit</h2>
              <p className="mt-4 text-gray-300">
                Senate review returns incomplete proposals. Use the template checklist so your ask
                is ready for diligence.
              </p>
              <ul className="mt-6 space-y-2">
                {CHECKLIST.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border-b border-white/5 py-2 text-gray-300"
                  >
                    <span className="mt-1 text-cyan-400/80">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <StandardButton
                  backgroundColor="bg-gradient-to-r from-blue-600 to-cyan-600"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/proposal-template"
                >
                  Open template
                </StandardButton>
                <StandardButton
                  backgroundColor="bg-white/10"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link={PROJECT_SYSTEM_CONFIG.docsUrl}
                  className="border border-white/15"
                >
                  Full documentation
                </StandardButton>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Active projects */}
      <section className="bg-[#060a14] px-4 py-16 md:px-8 md:py-24">
        <Container>
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">Active projects</h2>
                <p className="mt-3 text-gray-400">Work already funded this cycle.</p>
              </div>
              <Link href="/projects" className="text-sm text-blue-300 hover:text-blue-200">
                View all projects →
              </Link>
            </div>
            <DashboardActiveProjects
              currentProjects={currentProjects}
              usdBudget={usdBudget}
              showBudget={true}
              maxProjects={6}
            />
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-4 py-20 md:px-8 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,120,220,0.15),transparent_60%)]" />
        <Container>
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="font-GoodTimes text-3xl text-white md:text-5xl">
              Ready to propose?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-gray-300">
              Start from the template, keep the ask under ${MAX_BUDGET_USD.toLocaleString()}, and
              show how the work serves lunar settlement.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StandardButton
                className="!px-6 !py-3"
                backgroundColor="bg-white"
                textColor="text-black"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/propose"
              >
                Submit proposal
              </StandardButton>
              <StandardButton
                className="!px-6 !py-3 border border-white/20"
                backgroundColor="bg-transparent"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="https://moondao.com/discord"
              >
                Join Discord
              </StandardButton>
            </div>
          </div>
        </Container>
      </section>

      <section className="px-4 pb-16">
        <Container>
          <NoticeFooter
            defaultImage="../assets/MoonDAO-Logo-White.svg"
            defaultTitle="Questions about projects?"
            defaultDescription="Ask in Discord ideation before you submit—strong proposals start with community feedback."
            defaultButtonText="Join Discord"
            defaultButtonLink="https://moondao.com/discord"
            imageWidth={200}
            imageHeight={200}
          />
        </Container>
      </section>
    </>
  )
}

export default ProjectsOverview

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const { DEFAULT_CHAIN_V5, DISTRIBUTION_TABLE_NAMES, PROJECT_TABLE_NAMES } = await import(
      'const/config'
    )
    const { getChainSlug } = await import('@/lib/thirdweb/chain')

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const { quarter, year } = getRelativeQuarter(0)

    const statement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = await queryTable(chain, statement)

    const currentProjects = []
    const pastProjects = []

    if (projects && projects.length > 0) {
      for (let i = 0; i < projects.length; i++) {
        if (projects[i]) {
          const activeStatus = projects[i].active
          if (activeStatus == PROJECT_ACTIVE) {
            currentProjects.push(projects[i])
          } else if (activeStatus == PROJECT_ENDED) {
            pastProjects.push(projects[i])
          }
        }
      }
    }

    await enrichProjectNames([...currentProjects, ...pastProjects])

    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) return 0
      return a.eligible ? 1 : -1
    })

    const distributionStatement = `SELECT * FROM ${DISTRIBUTION_TABLE_NAMES[chainSlug]} WHERE year = ${year} AND quarter = ${quarter}`
    const distributions = await queryTable(chain, distributionStatement)

    return {
      props: {
        currentProjects: currentProjects.reverse(),
        pastProjects: pastProjects.reverse(),
        distributions,
      },
    }
  } catch (error) {
    console.error('Error fetching projects or distributions:', error)
    return {
      props: {
        currentProjects: [],
        pastProjects: [],
        distributions: [],
      },
    }
  }
}
