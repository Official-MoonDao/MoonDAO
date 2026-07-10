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
import { motion, useReducedMotion } from 'framer-motion'
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
import Reveal from '@/components/home/landing/Reveal'
import { PROJECT_ACTIVE } from '@/lib/nance/types'

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

const STEPS = [
  {
    n: '01',
    title: 'Ideate',
    body: 'Post the problem in Discord first. Feedback before a locked budget saves rewrite cycles.',
  },
  {
    n: '02',
    title: 'Propose',
    body: 'Use the template: novelty, lunar bridge, SMART key results, work-only budget under the max.',
  },
  {
    n: '03',
    title: 'Present & vote',
    body: 'Town Hall pitch, Senate diligence, then member vote. Funded leads join the Senate for the project.',
  },
  {
    n: '04',
    title: 'Ship & rewards',
    body: 'Weekly updates, final report, return unused funds. Completed work can earn quarterly retro rewards.',
  },
]

const FUND_YES = [
  {
    title: 'Labor for deliverables',
    body: 'Time that produces reports, code, protocols, curricula, or hardware you can inspect.',
  },
  {
    title: 'Specialized tools',
    body: 'Gear the work uniquely needs—with ownership or member-access terms—not a home office.',
  },
  {
    title: 'Open community assets',
    body: 'Methods, data, and software other MoonDAO projects can reuse.',
  },
]

const FUND_NO = [
  'General computers, monitors, printers, or furniture',
  'LLC / sole-prop formation or registration fees',
  'Tax bills, re-registration, or private runway bailouts',
]

const FIT_YES = [
  'You can name a lunar settlement outcome this quarter’s work changes',
  'You have shipped something of the same type before (or named a teammate who has)',
  'You can cite prior art and say honestly what is new',
  'You are active in MoonDAO—or bringing an engaged co-lead',
]

const FIT_NO = [
  'The ask is mostly company setup, taxes, or a general workstation',
  'The pitch is LEO tourism, generic STEAM branding, or inspiration alone',
  'Key Results are empty or the plan is a megaproject OKR in one quarter',
  'You are submitting multiple primary asks as the same Lead this quarter',
]

const CHECKLIST = [
  'Ask ≤ quarterly max',
  'Novelty & Prior Art with citations',
  'Explicit lunar bridge',
  'Community standing noted',
  'Non-empty SMART key results',
  'Budget classes A–E (C/D = $0)',
  'IP disclosed (open or retained)',
  'One primary ask per Lead this quarter',
  'Same-type prior work linked',
  'Partner LOIs if the plan depends on them',
]

const ProjectsOverview: React.FC<{
  currentProjects: Project[]
}> = ({ currentProjects }) => {
  const title = 'MoonDAO Project System'
  const description =
    "Quarterly grants for lunar-settlement work. See this quarter's max, what we fund, and how to submit a strong proposal."

  const { quarter, year } = getRelativeQuarter(0)
  const reduceMotion = useReducedMotion()

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

      {/* Hero — one composition: brand, headline, line, CTAs, full-bleed image */}
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#010208]">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: reduceMotion ? 1 : 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <Image
            src="/assets/projects-hero.png"
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/75 via-[#010208]/40 to-[#010208]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(34,211,238,0.18),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#010208] to-transparent" />

        <Container>
          <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-4 pb-16 pt-32 md:justify-center md:px-8 md:pb-28 md:pt-24">
            <motion.div
              initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            >
              <p className="mb-5 font-GoodTimes text-xs tracking-[0.4em] text-cyan-200/80 md:text-sm">
                MOONDAO
              </p>
              <h1 className="max-w-4xl font-GoodTimes text-4xl leading-[1.05] text-white md:text-6xl lg:text-7xl">
                Fund the work
                <span className="mt-2 block bg-gradient-to-r from-cyan-200 to-sky-400 bg-clip-text text-transparent">
                  that settles the Moon
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80 md:text-xl">
                Quarterly project grants for open tools, research, and specialized hardware—not
                company setup or baseline gear.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <StandardButton
                  className="!px-7 !py-3.5"
                  backgroundColor="bg-white"
                  textColor="text-black"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/propose"
                >
                  Submit a proposal
                </StandardButton>
                <StandardButton
                  className="!px-7 !py-3.5 border border-white/30"
                  backgroundColor="bg-white/5"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/proposal-template"
                >
                  Get the template
                </StandardButton>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Quarter facts — single strip */}
      <section className="border-y border-white/10 bg-[#050810] px-4 py-12 md:px-8">
        <Container>
          <Reveal>
            <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                  Max per project · Q{quarter} {year}
                </p>
                <p className="mt-2 font-GoodTimes text-4xl text-white md:text-5xl">
                  ${MAX_BUDGET_USD.toLocaleString()}
                </p>
                <p className="mt-2 text-sm text-white/45">1/5 of the quarterly project budget</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Submit by</p>
                <p className="mt-2 font-GoodTimes text-2xl text-white md:text-3xl">
                  {PROJECT_SYSTEM_CONFIG.submissionDeadline}
                </p>
                <p className="mt-2 text-sm text-white/45">2nd Thursday of the quarter</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">Member vote</p>
                <p className="mt-2 font-GoodTimes text-2xl text-white md:text-3xl">
                  {PROJECT_SYSTEM_CONFIG.votingDate}
                </p>
                <p className="mt-2 text-sm text-white/45">After Town Hall presentations</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Mission line */}
      <section className="px-4 py-20 md:px-8 md:py-28">
        <Container>
          <Reveal className="mx-auto max-w-3xl text-center">
            <h2 className="font-GoodTimes text-3xl leading-tight text-white md:text-5xl">
              Self-sustaining lunar settlement by 2030
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-300">
              Every funded project should leave an inspectable artifact that other members can use
              on that path—protocols, sims, hardware tests, open research—not a private company
              runway.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* What we fund */}
      <section className="relative overflow-hidden bg-[#050810] px-4 py-20 md:px-8 md:py-28">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <Container>
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">What we fund</h2>
              <p className="mt-4 max-w-2xl text-lg text-gray-300">
                Pay for mission outputs and tools the work uniquely needs. Do not ask for setup.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-12 lg:grid-cols-2">
              <Reveal delay={0.1}>
                <div className="space-y-10">
                  {FUND_YES.map((item, i) => (
                    <div key={item.title} className="border-l border-cyan-400/50 pl-6">
                      <p className="font-GoodTimes text-xs tracking-widest text-cyan-300/70">
                        0{i + 1}
                      </p>
                      <h3 className="mt-2 font-GoodTimes text-xl text-white">{item.title}</h3>
                      <p className="mt-2 text-gray-400">{item.body}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="border border-white/10 bg-black/30 p-8 md:p-10">
                  <h3 className="font-GoodTimes text-lg text-white/80">Do not fund</h3>
                  <ul className="mt-6 space-y-4">
                    {FUND_NO.map((item) => (
                      <li key={item} className="flex gap-3 text-gray-400">
                        <span className="mt-1 text-white/30">—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-sm leading-relaxed text-white/45">
                    Specialized mission gear is allowed when itemized with ownership or access
                    terms. A new desktop for writing is not.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* Fit check */}
      <section className="px-4 py-20 md:px-8 md:py-28">
        <Container>
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">Is this for you?</h2>
              <p className="mt-4 max-w-2xl text-lg text-gray-300">
                Strong proposals clear these bars before Senate review. Weak ones get returned for
                rewrite.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-12 md:grid-cols-2">
              <Reveal delay={0.1}>
                <h3 className="font-GoodTimes text-sm tracking-[0.2em] text-cyan-300/80">
                  GOOD FIT
                </h3>
                <ul className="mt-6 space-y-4">
                  {FIT_YES.map((item) => (
                    <li key={item} className="border-b border-white/10 pb-4 text-gray-200">
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.2}>
                <h3 className="font-GoodTimes text-sm tracking-[0.2em] text-white/40">
                  NOT A FIT
                </h3>
                <ul className="mt-6 space-y-4">
                  {FIT_NO.map((item) => (
                    <li key={item} className="border-b border-white/10 pb-4 text-gray-400">
                      {item}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-[#050810] px-4 py-20 md:px-8 md:py-28">
        <Container>
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">How it works</h2>
            </Reveal>
            <div className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <Reveal key={step.n} delay={0.08 * i}>
                  <p className="font-GoodTimes text-sm tracking-[0.25em] text-cyan-300/60">
                    {step.n}
                  </p>
                  <h3 className="mt-3 font-GoodTimes text-xl text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-400">{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Pool + checklist */}
      <section className="px-4 py-20 md:px-8 md:py-28">
        <Container>
          <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2">
            <Reveal>
              <h2 className="font-GoodTimes text-3xl text-white">This quarter&apos;s pool</h2>
              <p className="mt-4 text-gray-300">
                Proposal asks stay at or under the per-project max. Retroactive rewards for
                completed work sit alongside that pool.
              </p>
              <div className="mt-10 space-y-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    Stablecoin retro pool
                  </p>
                  <p className="mt-2 font-GoodTimes text-4xl text-white">
                    ${NEXT_QUARTER_BUDGET_USD.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">
                    vMOONEY retro pool
                  </p>
                  <p className="mt-2 font-GoodTimes text-3xl text-white">
                    {mooneyBudget > 0 ? (
                      <>
                        {Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                        <span className="ml-2 font-sans text-base text-white/45">
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
                  <p className="mt-2 text-sm text-white/40">Locked 4 years as delegated vMOONEY</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <h2 className="font-GoodTimes text-3xl text-white">Before you submit</h2>
              <p className="mt-4 text-gray-300">
                Incomplete proposals are returned. Work through the template checklist first.
              </p>
              <ul className="mt-8 space-y-0">
                {CHECKLIST.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border-b border-white/10 py-3 text-gray-300"
                  >
                    <span className="mt-0.5 text-cyan-400/90" aria-hidden>
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <StandardButton
                  backgroundColor="bg-white"
                  textColor="text-black"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link="/proposal-template"
                >
                  Open template
                </StandardButton>
                <StandardButton
                  backgroundColor="bg-transparent"
                  textColor="text-white"
                  borderRadius="rounded-xl"
                  hoverEffect={false}
                  link={PROJECT_SYSTEM_CONFIG.docsUrl}
                  className="border border-white/20"
                >
                  Full documentation
                </StandardButton>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Active projects */}
      <section className="bg-[#050810] px-4 py-20 md:px-8 md:py-28">
        <Container>
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-GoodTimes text-3xl text-white md:text-4xl">
                    Active projects
                  </h2>
                  <p className="mt-3 text-gray-400">Work already funded this cycle.</p>
                </div>
                <Link
                  href="/projects"
                  className="text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                >
                  View all projects →
                </Link>
              </div>
            </Reveal>
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
      <section className="relative overflow-hidden px-4 py-24 md:px-8 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(34,211,238,0.12),transparent_55%)]" />
        <Container>
          <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="font-GoodTimes text-3xl text-white md:text-5xl">
              Bring a lunar-ready idea
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300">
              Start from the template, keep the ask under ${MAX_BUDGET_USD.toLocaleString()}, cite
              prior art, and show the lunar bridge.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <StandardButton
                className="!px-7 !py-3.5"
                backgroundColor="bg-white"
                textColor="text-black"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/propose"
              >
                Submit proposal
              </StandardButton>
              <StandardButton
                className="!px-7 !py-3.5 border border-white/25"
                backgroundColor="bg-transparent"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="https://moondao.com/discord"
              >
                Ideate in Discord
              </StandardButton>
            </div>
          </Reveal>
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
    const { DEFAULT_CHAIN_V5, PROJECT_TABLE_NAMES } = await import('const/config')
    const { getChainSlug } = await import('@/lib/thirdweb/chain')

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)

    const statement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = await queryTable(chain, statement)

    const currentProjects = []

    if (projects && projects.length > 0) {
      for (let i = 0; i < projects.length; i++) {
        if (projects[i] && projects[i].active == PROJECT_ACTIVE) {
          currentProjects.push(projects[i])
        }
      }
    }

    await enrichProjectNames(currentProjects)

    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) return 0
      return a.eligible ? 1 : -1
    })

    return {
      props: {
        currentProjects: currentProjects.reverse(),
      },
    }
  } catch (error) {
    console.error('Error fetching projects:', error)
    return {
      props: {
        currentProjects: [],
      },
    }
  }
}
