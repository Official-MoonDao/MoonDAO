import { FEATURED_MISSION } from 'const/config'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useContext, useEffect, useRef, useState } from 'react'
import { TOUR_POSTER, TOUR_STOPS, type TourStopId } from '@/lib/home-tour/stops'
import CitizenContext from '@/lib/citizen/citizen-context'
import LandingHero from '@/components/home/landing/LandingHero'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import WebsiteHead from '@/components/layout/Head'
import { MissionSkeleton, SectionSkeleton } from '@/components/layout/SkeletonLoader'
import TourScene from './TourScene'
import TourStop from './TourStop'
import useActiveStop from './useActiveStop'
import useTourRenderMode from './useTourRenderMode'

const FeaturedMissionSection = dynamic(() => import('@/components/home/FeaturedMissionSection'), {
  loading: () => <MissionSkeleton />,
  ssr: false,
})

const MissionStory = dynamic(() => import('@/components/home/landing/MissionStory'), {
  loading: () => <SectionSkeleton />,
})

const PillarsSection = dynamic(() => import('@/components/home/landing/PillarsSection'), {
  loading: () => <SectionSkeleton />,
})

const GovernanceSection = dynamic(() => import('@/components/home/landing/GovernanceSection'), {
  loading: () => <SectionSkeleton />,
})

const LaunchpadShowcase = dynamic(() => import('@/components/home/landing/LaunchpadShowcase'), {
  loading: () => <SectionSkeleton />,
})

const JourneyTimeline = dynamic(() => import('@/components/home/landing/JourneyTimeline'), {
  loading: () => <SectionSkeleton />,
})

const VoicesSection = dynamic(() => import('@/components/home/landing/VoicesSection'), {
  loading: () => <SectionSkeleton />,
})

const PartnersMarquee = dynamic(() => import('@/components/home/landing/PartnersMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})

const FinalCTA = dynamic(() => import('@/components/home/landing/FinalCTA'), {
  loading: () => <SectionSkeleton />,
})

export default function HomeTour({ missions, featuredMissionData }: any) {
  const router = useRouter()
  const { citizen, isLoading } = useContext(CitizenContext)

  const activeId = useActiveStop<TourStopId>('hero')
  // Past the last stop the scene fades out, but it keeps the stop it was on so
  // scrolling back up does not fly it in from somewhere else.
  const lastId = useRef<TourStopId>('hero')
  if (activeId) lastId.current = activeId
  const stop = TOUR_STOPS[lastId.current]

  const [journeyYear, setJourneyYear] = useState<number | null>(null)
  const year = activeId === 'journey' ? journeyYear : null

  const mode = useTourRenderMode()
  // The open window above each section only shows something when the camera
  // has flown somewhere; over a still it is just an empty band of poster.
  const windows = mode === 'globe'

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
        <TourScene stop={stop} year={year} visible={activeId !== null} mode={mode} />

        <div className="relative z-10">
          <TourStop stop={TOUR_STOPS.hero} showWindow={false} veil={false}>
            <LandingHero variant="tour" />
          </TourStop>
          {FEATURED_MISSION && (
            <TourStop showWindow={windows} stop={TOUR_STOPS.featured}>
              <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
            </TourStop>
          )}
          <TourStop showWindow={windows} stop={TOUR_STOPS.network}>
            <MissionStory transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.pillars}>
            <PillarsSection transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.governance}>
            <GovernanceSection transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.launchpad}>
            <LaunchpadShowcase transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.journey} veil="light">
            <JourneyTimeline transparent onYearChange={setJourneyYear} />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.voices}>
            <VoicesSection transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.partners}>
            <PartnersMarquee transparent />
          </TourStop>
          <TourStop showWindow={windows} stop={TOUR_STOPS.cta}>
            <FinalCTA transparent />
          </TourStop>
        </div>

        <div className="relative z-10 bg-[#010208]">
          <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
        </div>
      </div>
    </Container>
  )
}
