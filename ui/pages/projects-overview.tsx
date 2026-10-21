import { ANNOUNCE_PROJECT_BUDGET, PROJECT_SYSTEM_CONFIG, NEXT_QUARTER_BUDGET_USD } from 'const/config'
import { motion, useReducedMotion } from 'framer-motion'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { PROJECT_ACTIVE } from '@/lib/nance/types'
import { enrichProjectNames } from '@/lib/project/enrichProjectNames'
import { Project } from '@/lib/project/useProjectData'
import queryTable from '@/lib/tableland/queryTable'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import Reveal from '@/components/home/landing/Reveal'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import DashboardActiveProjects from '@/components/project/DashboardActiveProjects'
import ProposalJourney from '@/components/project/ProposalJourney'

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

// Recurring rules only. Dates and amounts change every quarter and live on
// /proposals and /projects, driven by PROJECT_CYCLE in const/config.
const CADENCE = [
  { label: 'Every quarter', value: 'A new funding round' },
  { label: 'Second Thursday of the quarter', value: 'Proposals due' },
  { label: 'Third Thursday of the quarter', value: 'Member vote' },
]

const FUND = [
  {
    title: 'Research & open data',
    body: 'Studies, simulations and datasets that move lunar settlement forward and that anyone can build on.',
  },
  {
    title: 'Tools & software',
    body: 'Code, protocols and designs that other MoonDAO projects can reuse.',
  },
  {
    title: 'Hardware & tests',
    body: 'Prototypes and experiments that turn ideas into results you can inspect.',
  },
]

const FUNDING = [
  {
    title: 'A quarterly pot',
    body: 'Each round is funded from the treasury, currently 3% of its liquid assets, so the pot grows with the DAO.',
  },
  {
    title: 'Shared across projects',
    body: 'Each funded project can receive up to a quarter of the pot, so no single project takes it all.',
  },
  {
    title: 'Rewards for shipping',
    body: 'Completed projects can earn retroactive rewards each quarter, including vMOONEY locked for four years.',
  },
]

const ProjectsOverview: React.FC<{
  currentProjects: Project[]
}> = ({ currentProjects }) => {
  const title = 'MoonDAO Project System'
  const description =
    'Quarterly community grants for work that helps settle the Moon. See how projects are proposed, voted on and funded.'

  const reduceMotion = useReducedMotion()

  return (
    <>
      <WebsiteHead title={title} description={description} image="/assets/MoonDAO-OG.png" />

      <Container>
        <div className="bg-[#010208]">
          {/* Hero — one composition: brand, headline, line, CTAs, full-bleed image */}
          <section className="relative min-h-[60svh] w-full overflow-hidden bg-[#010208]">
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
            <div className="relative z-10 flex min-h-[60svh] flex-col justify-end px-4 pb-10 pt-20 md:justify-center md:px-8 md:pb-12 md:pt-16">
              <motion.div
                initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
              >
                <p className="mb-5 font-heading font-semibold text-xs tracking-[0.4em] text-cyan-200/80 md:text-sm">
                  MOONDAO
                </p>
                <h1 className="max-w-4xl font-heading font-semibold text-3xl leading-[1.05] text-white md:text-5xl">
                  Fund the work
                  <span className="mt-2 block bg-gradient-to-r from-cyan-200 to-sky-400 bg-clip-text text-transparent">
                    that settles the Moon
                  </span>
                </h1>
                <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80 md:text-xl">
                  Every quarter, the MoonDAO community funds open research, tools and hardware that
                  bring a lunar settlement closer.
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
                    link="/projects"
                  >
                    Explore projects
                  </StandardButton>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Cadence — the recurring schedule; this quarter's dates live on /proposals */}
          <section className="border-y border-white/10 bg-[#050810] px-4 py-12 md:px-8">
            <Reveal>
              <div className="mx-auto max-w-6xl">
                <div className="grid gap-10 md:grid-cols-3">
                  {CADENCE.map((item) => (
                    <div key={item.label}>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">{item.label}</p>
                      <p className="mt-2 font-heading font-semibold text-2xl text-white md:text-3xl">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/proposals"
                  className="mt-8 inline-block text-sm text-cyan-300 transition-colors hover:text-cyan-200"
                >
                  See this quarter&apos;s dates →
                </Link>
              </div>
            </Reveal>
          </section>

          {/* Mission line */}
          <section className="px-4 py-20 md:px-8 md:py-28">
            <Reveal className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading font-semibold text-2xl leading-tight text-white md:text-3xl">
                Self-sustaining lunar settlement by 2030
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-gray-300">
                Every funded project leaves something other members can use on that path: protocols,
                simulations, hardware tests and open research.
              </p>
            </Reveal>
          </section>

          {/* What we fund */}
          <section className="relative overflow-hidden bg-[#050810] px-4 py-20 md:px-8 md:py-28">
            <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="mx-auto max-w-6xl">
              <Reveal>
                <h2 className="font-heading font-semibold text-2xl text-white md:text-3xl">
                  What we fund
                </h2>
                <p className="mt-4 max-w-2xl text-lg text-gray-300">
                  Work that produces something the community can see, use and build on.
                </p>
              </Reveal>
              <div className="mt-14 grid gap-10 md:grid-cols-3">
                {FUND.map((item, i) => (
                  <Reveal key={item.title} delay={0.08 * i}>
                    <div className="border-l border-cyan-400/50 pl-6">
                      <p className="font-heading font-semibold text-xs tracking-widest text-cyan-300/70">
                        0{i + 1}
                      </p>
                      <h3 className="mt-2 font-heading font-semibold text-xl text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-gray-400">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="px-4 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
              <Reveal>
                <h2 className="font-heading font-semibold text-2xl text-white md:text-3xl">
                  How it works
                </h2>
              </Reveal>
              <ProposalJourney />
            </div>
          </section>

          {/* How funding works */}
          <section className="bg-[#050810] px-4 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
              <Reveal>
                <h2 className="font-heading font-semibold text-2xl text-white md:text-3xl">
                  How funding works
                </h2>
              </Reveal>
              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {FUNDING.map((item, i) => (
                  <Reveal key={item.title} delay={0.08 * i}>
                    <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                      <h3 className="font-heading font-semibold text-lg text-white">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.2}>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <StandardButton
                    backgroundColor="bg-white"
                    textColor="text-black"
                    borderRadius="rounded-xl"
                    hoverEffect={false}
                    link="/proposal-template"
                  >
                    Open the template
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
          </section>

          {/* Active projects */}
          <section className="px-4 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
              <Reveal>
                <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-heading font-semibold text-2xl text-white md:text-3xl">
                      Active projects
                    </h2>
                    <p className="mt-3 text-gray-400">Work the community is funding right now.</p>
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
                usdBudget={NEXT_QUARTER_BUDGET_USD}
                showBudget={ANNOUNCE_PROJECT_BUDGET}
                maxProjects={6}
              />
            </div>
          </section>

          {/* Final CTA */}
          <section className="relative overflow-hidden px-4 py-24 md:px-8 md:py-32">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(34,211,238,0.12),transparent_55%)]" />
            <Reveal className="relative z-10 mx-auto max-w-3xl text-center">
              <h2 className="font-heading font-semibold text-3xl text-white md:text-5xl">
                Bring a lunar-ready idea
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-gray-300">
                Share it in Discord, write it up, and pitch it to the community at Town Hall.
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
          </section>

          <section className="px-4 pb-16">
            <NoticeFooter
              defaultImage="../assets/MoonDAO-Logo-White.svg"
              defaultTitle="Questions about projects?"
              defaultDescription="Ask in Discord before you submit. Strong proposals start with community feedback."
              defaultButtonText="Join Discord"
              defaultButtonLink="https://moondao.com/discord"
              imageWidth={200}
              imageHeight={200}
            />
          </section>
        </div>
      </Container>
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
