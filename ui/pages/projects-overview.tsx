import {
  ARBITRUM_ASSETS_URL,
  POLYGON_ASSETS_URL,
  BASE_ASSETS_URL,
} from 'const/config'
import useStakedEth from 'lib/utils/hooks/useStakedEth'
import { GetServerSideProps } from 'next'
import Image from 'next/image'
import React, { useMemo, useEffect, useState } from 'react'
import { useAssets } from '@/lib/dashboard/hooks'
import { Project } from '@/lib/project/useProjectData'
import { ethereum } from '@/lib/rpc/chains'
import queryTable from '@/lib/tableland/queryTable'
import { useUniswapTokens } from '@/lib/uniswap/hooks/useUniswapTokens'
import { getRelativeQuarter } from '@/lib/utils/dates'
import { getBudget } from '@/lib/utils/rewards'
import ProjectsSection from '../components/home/ProjectsSection'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'
import StandardButton from '../components/layout/StandardButton'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import ProjectCard from '@/components/project/ProjectCard'

// Project System Explainer Card Component
const ProjectExplainerCard = ({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) => {
  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 rounded-2xl border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 hover:scale-[1.02] p-6">
      <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-GoodTimes text-white mb-4 text-center">
        {title}
      </h3>
      <p className="text-gray-300 leading-relaxed text-center">{description}</p>
    </div>
  )
}

const ProjectsOverview: React.FC<{
  currentProjects: Project[]
  pastProjects: Project[]
  distributions: any[]
}> = ({ currentProjects, pastProjects, distributions }) => {
  const title = 'Project System Overview'
  const description =
    "Learn about MoonDAO's decentralized project system. From proposal submission to retroactive rewards, discover how we fund and support space-related initiatives that advance our mission to establish a permanent settlement on the Moon."

  // Get current quarter info
  const { quarter, year } = getRelativeQuarter(0)

  // Hook to get token data for budget calculations
  const { tokens: mainnetTokens } = useAssets()
  const { tokens: arbitrumTokens } = useAssets(ARBITRUM_ASSETS_URL)
  const { tokens: polygonTokens } = useAssets(POLYGON_ASSETS_URL)
  const { tokens: baseTokens } = useAssets(BASE_ASSETS_URL)
  const { stakedEth } = useStakedEth()
  const { MOONEY, DAI } = useUniswapTokens(ethereum)

  const [mooneyBudgetUSD, setMooneyBudgetUSD] = useState<number | null>(null)
  const [isLoadingMooneyUSD, setIsLoadingMooneyUSD] = useState(true)

  // Combine all tokens
  const tokens = useMemo(() => {
    return mainnetTokens
      .concat(arbitrumTokens)
      .concat(polygonTokens)
      .concat(baseTokens)
      .filter((token: any) => token.usd > 1)
      .concat([{ symbol: 'stETH', balance: stakedEth }])
  }, [mainnetTokens, arbitrumTokens, polygonTokens, baseTokens, stakedEth])

  // Calculate budget
  const {
    ethBudget: ethBudgetCalculated,
    mooneyBudget,
    ethPrice,
  } = useMemo(() => getBudget(tokens, year, quarter), [tokens, year, quarter])

  // Use hardcoded value like in RetroactiveRewards for current quarter
  const ethBudget = 17.09
  const usdBudget = ethBudget * ethPrice

  // Calculate MOONEY USD value
  useEffect(() => {
    let isCancelled = false

    async function getMooneyBudgetUSD() {
      try {
        if (!mooneyBudget || mooneyBudget < 0.01) {
          setMooneyBudgetUSD(0)
          setIsLoadingMooneyUSD(false)
          return
        }
      } catch (error) {
        console.error('Error fetching Mooney budget USD:', error)
        if (!isCancelled) {
          setMooneyBudgetUSD(0)
          setIsLoadingMooneyUSD(false)
        }
      }
    }

    if (mooneyBudget && MOONEY && DAI) {
      getMooneyBudgetUSD()
    } else if (mooneyBudget === 0) {
      setIsLoadingMooneyUSD(false)
    }

    return () => {
      isCancelled = true
    }
  }, [mooneyBudget, DAI, MOONEY])

  return (
    <>
      <WebsiteHead
        title={title}
        description={description}
        image="/assets/moondao-og.jpg"
      />

      {/* Hero Section */}
      <Container>
        <div className="relative w-full h-screen rounded-3xl overflow-hidden">
          <Image
            src="/assets/projects-hero.png"
            alt="MoonDAO Projects"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-4xl px-8">
              <h1 className="header font-GoodTimes text-white drop-shadow-lg mb-4">
                Project System
              </h1>
              <p className="sub-header text-white/90 drop-shadow-lg">
                MoonDAO's decentralized project system funds mission-aligned
                initiatives that advance our goal of establishing a permanent
                settlement on the Moon.
              </p>
              <StandardButton
                className="gradient-2 hover:opacity-90 transition-opacity"
                textColor="text-white"
                borderRadius="rounded-xl"
                hoverEffect={false}
                link="/proposals"
              >
                Submit Proposal
              </StandardButton>
            </div>
          </div>
        </div>
      </Container>

      {/* Projects Section from Homepage */}
      <ProjectsSection />

      {/* Project System Explainer Section */}
      <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <Container>
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16 px-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-GoodTimes text-white mb-6">
                How Our Project System Works
              </h2>
              <p className="text-lg md:text-xl text-gray-300 max-w-4xl mx-auto">
                MoonDAO Projects are goal-oriented teams working on
                mission-aligned objectives. Our comprehensive framework supports
                project funding, progress tracking, and provides retroactive
                incentives for successful contributions.
              </p>
            </div>

            {/* Project Process Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 mx-4">
              <ProjectExplainerCard
                icon={
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                }
                title="1. Ideation"
                description="Share your space-related ideas in our Discord ideation channel. Get feedback from the community and refine your concept."
              />

              <ProjectExplainerCard
                icon={
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                title="2. Proposal"
                description="Submit a detailed project proposal using our template. Include objectives, timeline, budget, and team structure."
              />

              <ProjectExplainerCard
                icon={
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
                title="3. Execution"
                description="Once approved, project leads join the Senate and receive funding. Teams provide weekly updates and progress reports."
              />

              <ProjectExplainerCard
                icon={
                  <svg
                    className="w-12 h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                }
                title="4. Rewards"
                description="Completed projects receive quarterly retroactive rewards based on community evaluation and impact assessment."
              />
            </div>

            {/* Quarterly Rewards System */}
            <div className="relative mx-4 mb-16">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-purple-900/10 to-teal-900/10 rounded-3xl" />
              <div className="relative p-6 md:p-12 bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                  <h3 className="text-2xl md:text-3xl font-GoodTimes text-white mb-4">
                    Quarterly Rewards System
                  </h3>
                  <p className="text-gray-300 max-w-3xl mx-auto">
                    MoonDAO incentivizes innovation through our quarterly
                    rewards program, distributing both ETH and vMOONEY to
                    successful project contributors.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* ETH Rewards */}
                  <div className="bg-gradient-to-br from-orange-900/20 to-yellow-900/20 rounded-2xl p-6 border border-orange-500/20">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
                      </svg>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-3">
                      ETH Rewards
                    </h4>
                    <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-lg p-3 mb-3 border border-orange-400/20">
                      <div className="text-2xl font-bold text-orange-400">
                        {ethBudget.toFixed(2)} ETH{' '}
                        <span className="text-lg text-orange-300">
                          ($
                          {usdBudget.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                          )
                        </span>
                      </div>
                      <div className="text-sm text-orange-300">
                        Available Q{quarter} {year}
                      </div>
                    </div>
                    <p className="text-gray-300 mb-3">
                      5% of liquid non-MOONEY assets distributed quarterly to
                      completed projects based on community evaluation.
                    </p>
                    <p className="text-sm text-orange-400">
                      Paid as lump-sum within a month of quarter end
                    </p>
                  </div>

                  {/* vMOONEY Rewards */}
                  <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl p-6 border border-blue-500/20">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-3">
                      vMOONEY Rewards
                    </h4>
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 mb-3 border border-blue-400/20">
                      <div className="text-2xl font-bold text-blue-400">
                        {Number(mooneyBudget.toPrecision(3)).toLocaleString()}
                        <span className="text-lg text-blue-300">
                          {isLoadingMooneyUSD ? (
                            <span className="ml-2 opacity-70">(...)</span>
                          ) : mooneyBudgetUSD !== null &&
                            mooneyBudgetUSD > 0 ? (
                            ` (${mooneyBudgetUSD.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                              style: 'currency',
                              currency: 'USD',
                            })})`
                          ) : null}
                        </span>
                      </div>
                      <div className="text-sm text-blue-300">
                        vMOONEY Available Q{quarter} {year}
                      </div>
                    </div>
                    <p className="text-gray-300 mb-3">
                      Geometric series of MOONEY tokens decreasing by 5% each
                      quarter, distributed based on project impact and community
                      evaluation.
                    </p>
                    <p className="text-sm text-blue-400">
                      Locked for 4 years as delegated vMOONEY
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Projects Section */}
            <div className="relative mx-4 mb-16">
              <div className="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="text-center mb-8">
                  <h3 className="text-2xl md:text-3xl font-GoodTimes text-white mb-4">
                    Active Projects
                  </h3>
                  <p className="text-gray-300 max-w-3xl mx-auto">
                    Explore the exciting space-focused projects currently in
                    development by our community. Each project represents a step
                    toward our mission of establishing a permanent settlement on
                    the Moon.
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  {currentProjects && currentProjects.length > 0 ? (
                    currentProjects.slice(0, 3).map((project: any, i) => (
                      <div
                        key={`active-project-${i}`}
                        className="bg-black/20 rounded-xl border border-white/10 overflow-hidden"
                      >
                        <ProjectCard
                          key={`active-project-${i}`}
                          project={project}
                          projectContract={null}
                          hatsContract={null}
                          distribute={false}
                          distribution={undefined}
                          handleDistributionChange={undefined}
                          userHasVotingPower={false}
                          isVotingPeriod={false}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>There are no active projects at the moment.</p>
                      <p className="text-sm mt-2">
                        Check back soon or submit your own project proposal!
                      </p>
                    </div>
                  )}
                </div>

                {currentProjects && currentProjects.length > 3 && (
                  <div className="text-center mt-8">
                    <StandardButton
                      backgroundColor="bg-gradient-to-r from-purple-600 to-pink-600"
                      textColor="text-white"
                      borderRadius="rounded-full"
                      hoverEffect={false}
                      link="/projects"
                    >
                      View All {currentProjects.length} Active Projects
                    </StandardButton>
                  </div>
                )}
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center px-4">
              <h3 className="text-2xl md:text-3xl font-GoodTimes text-white mb-6">
                Ready to Build the Future?
              </h3>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
                Join our community of space entrepreneurs and contribute to
                humanity's multiplanetary future. Whether you're a developer,
                engineer, researcher, or creative, there's a place for you in
                the MoonDAO ecosystem.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <StandardButton
                  backgroundColor="bg-gradient-to-r from-blue-600 to-purple-600"
                  textColor="text-white"
                  borderRadius="rounded-full"
                  hoverEffect={false}
                  link="/projects"
                >
                  Explore Active Projects
                </StandardButton>
                <StandardButton
                  backgroundColor="bg-gradient-to-r from-green-600 to-teal-600"
                  textColor="text-white"
                  borderRadius="rounded-full"
                  hoverEffect={false}
                  link="/proposals"
                >
                  Submit Your Proposal
                </StandardButton>
                <StandardButton
                  backgroundColor="bg-gradient-to-r from-purple-600 to-pink-600"
                  textColor="text-white"
                  borderRadius="rounded-full"
                  hoverEffect={false}
                  link="/project-system-docs"
                >
                  Read Full Documentation
                </StandardButton>
              </div>
            </div>

            {/* Notice Footer */}
            <div className="mt-16">
              <NoticeFooter
                defaultImage="../assets/MoonDAO-Logo-White.svg"
                defaultTitle="Questions About Projects?"
                defaultDescription="Join our Discord community to discuss project ideas and get support from fellow space entrepreneurs!"
                defaultButtonText="Join Discord"
                defaultButtonLink="https://discord.gg/moondao"
                imageWidth={200}
                imageHeight={200}
              />
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

export default ProjectsOverview

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    // Import the same constants and functions used in the projects page
    const { DEFAULT_CHAIN_V5, DISTRIBUTION_TABLE_NAMES, PROJECT_TABLE_NAMES } =
      await import('const/config')
    const { getChainSlug } = await import('@/lib/thirdweb/chain')

    const chain = DEFAULT_CHAIN_V5
    const chainSlug = getChainSlug(chain)
    const { quarter, year } = getRelativeQuarter(0)

    // Get current and past projects
    const statement = `SELECT * FROM ${PROJECT_TABLE_NAMES[chainSlug]}`
    const projects = await queryTable(chain, statement)

    const currentProjects = []
    const pastProjects = []

    if (projects && projects.length > 0) {
      for (let i = 0; i < projects.length; i++) {
        if (projects[i]) {
          const project = projects[i] as any
          // Use the 'active' field to determine current vs past projects
          if (project.active) {
            currentProjects.push(project)
          } else {
            pastProjects.push(project)
          }
        }
      }
    }

    currentProjects.sort((a, b) => {
      if (a.eligible === b.eligible) {
        return 0
      }
      return a.eligible ? 1 : -1
    })

    // Get distributions for budget calculations
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
