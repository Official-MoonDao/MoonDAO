import { FEATURED_MISSION } from 'const/config'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { TOUR_POSTER, TOUR_STOPS, type TourStopId } from '@/lib/home-tour/stops'
import CitizenContext from '@/lib/citizen/citizen-context'
import CtaButton from '@/components/home/landing/CtaButton'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import WebsiteHead from '@/components/layout/Head'
import MailingList from '@/components/layout/MailingList'
import { MissionSkeleton, SectionSkeleton } from '@/components/layout/SkeletonLoader'
import RoadmapCard from './RoadmapCard'
import TourCard from './TourCard'
import TourChapter from './TourChapter'
import TourRail from './TourRail'
import TourScene from './TourScene'
import useActiveStop from './useActiveStop'
import useTourRenderMode from './useTourRenderMode'

const FeaturedMissionSection = dynamic(() => import('@/components/home/FeaturedMissionSection'), {
  loading: () => <MissionSkeleton />,
  ssr: false,
})

const PartnersMarquee = dynamic(() => import('@/components/home/landing/PartnersMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})

export default function HomeTour({ missions, featuredMissionData }: any) {
  const router = useRouter()
  const { citizen, isLoading } = useContext(CitizenContext)

  const activeId = useActiveStop<TourStopId>('arrival')
  // Past the last stop the scene fades out, but it keeps the stop it was on so
  // scrolling back up does not fly it in from somewhere else.
  const lastId = useRef<TourStopId>('arrival')
  if (activeId) lastId.current = activeId
  const stop = TOUR_STOPS[lastId.current]

  const [roadmapBuild, setRoadmapBuild] = useState(0)
  const onBuildChange = useCallback((b: number) => setRoadmapBuild(b), [])
  const build = activeId === 'roadmap' ? roadmapBuild : null

  const mode = useTourRenderMode()

  // Redirect citizens to dashboard
  useEffect(() => {
    if (!isLoading && citizen) {
      router.push('/dashboard')
    }
  }, [citizen, isLoading, router])

  // Show nothing while checking/redirecting
  if (citizen) {
    return null
  }

  return (
    <Container>
      <Head>
        <link rel="preload" as="image" href={TOUR_POSTER} />
      </Head>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div className="relative bg-[#010208]">
        <TourScene stop={stop} build={build} visible={activeId !== null} mode={mode} />
        <TourRail active={activeId} />

        <div className="relative z-10">
          <TourChapter id="arrival" heightSvh={130} fadeIn={false}>
            <TourCard
              as="h1"
              location="Moon Base Zero · Lunar south pole"
              title={
                <>
                  The Internet&apos;s <span className="text-moon-gold">Space</span> Program
                </>
              }
              actions={
                <>
                  <CtaButton href="/join" variant="primary">
                    Join the Network
                  </CtaButton>
                  <CtaButton href="/launch" variant="quiet">
                    Explore Missions
                  </CtaButton>
                </>
              }
            >
              This is the lunar settlement MoonDAO is working toward. MoonDAO is an open platform to
              fund, collaborate, and compete on the challenges that get us here, governed by its
              members and transparent by design.
            </TourCard>
            <p className="mt-10 flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/50">
              <span className="block h-px w-8 bg-white/40" />
              Scroll to tour the base
            </p>
          </TourChapter>

          <TourChapter id="landing">
            <TourCard
              location={TOUR_STOPS.landing.label}
              title="Every settlement starts with a landing."
              stat={{ value: '$8M+', label: 'Raised onchain' }}
              actions={
                <CtaButton href="/launch" variant="primary">
                  Launch a Mission
                </CtaButton>
              }
            >
              The first arrivals are the commercial landers heading for the lunar south pole right
              now. MoonDAO&apos;s Launchpad lets anyone crowdfund missions like these onchain, from
              anywhere on Earth.
            </TourCard>
          </TourChapter>

          <TourChapter id="habitat">
            <TourCard
              location={TOUR_STOPS.habitat.label}
              title="Governed by the people who'll live here."
              stat={{ value: '12,000+', label: 'Token holders' }}
              actions={
                <>
                  <CtaButton href="/get-mooney" variant="primary">
                    Get $MOONEY
                  </CtaButton>
                  <CtaButton href="/constitution" variant="quiet">
                    Read the Constitution
                  </CtaButton>
                </>
              }
            >
              Every decision about this base goes to a vote. Our constitution was ratified onchain,
              then landed on the Moon in early 2025. Lock $MOONEY to have a say in what gets built
              next.
            </TourCard>
          </TourChapter>

          <TourChapter id="construction">
            <TourCard
              location={TOUR_STOPS.construction.label}
              title="Built in the open."
              stat={{ value: '$750,000+', label: 'Granted to 100+ projects' }}
              actions={
                <CtaButton href="/proposals" variant="primary">
                  See What&apos;s Being Funded
                </CtaButton>
              }
            >
              Each module you see maps to real work underway today. Members choose what gets
              funded by open vote, and every dollar is traceable onchain.
            </TourCard>
          </TourChapter>

          <TourChapter id="network">
            <TourCard
              location={TOUR_STOPS.network.label}
              title="A network, not a company."
              stat={{ value: '2', label: 'Astronauts sent to space' }}
              actions={
                <CtaButton href="/network" variant="primary">
                  Explore the Network
                </CtaButton>
              }
            >
              These towers keep the base talking to Earth. The Space Acceleration Network does the
              same for people: builders, researchers and teams around the world coordinating on one
              goal.
            </TourCard>
          </TourChapter>

          <TourChapter id="roadmap" heightSvh={300}>
            {(pinned) => <RoadmapCard pinned={pinned} onBuildChange={onBuildChange} />}
          </TourChapter>

          <TourChapter id="join">
            <TourCard
              location={TOUR_STOPS.join.label}
              title="Take humanity back to the Moon."
              actions={
                <>
                  <CtaButton href="/join" variant="primary">
                    Join the Network
                  </CtaButton>
                  <CtaButton href="/docs" variant="quiet">
                    Learn More
                  </CtaButton>
                </>
              }
            >
              Whether you&apos;re new to Web3 or a space industry veteran, there&apos;s a place for
              you in building this.
            </TourCard>
            <div className="mt-10 max-w-md">
              <p className="mb-3 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/50">
                Or get weekly mission updates
              </p>
              <MailingList submitLabel="Subscribe" quietSubmit compact />
            </div>
          </TourChapter>
        </div>

        <div className="relative z-10 bg-[#010208]">
          {FEATURED_MISSION && (
            <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
          )}
          <PartnersMarquee />
          <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
        </div>
      </div>
    </Container>
  )
}
