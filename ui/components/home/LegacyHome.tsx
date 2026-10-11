import { FEATURED_MISSION } from 'const/config'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useContext, useEffect } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import LandingHero from '@/components/home/landing/LandingHero'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import WebsiteHead from '@/components/layout/Head'
import { MissionSkeleton, SectionSkeleton } from '@/components/layout/SkeletonLoader'

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

export default function LegacyHome({ missions, featuredMissionData }: any) {
  const router = useRouter()
  const { citizen, isLoading } = useContext(CitizenContext)

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
        {/* Preload critical background images */}
        <link rel="preload" as="image" href="/assets/Lunar-Colony-Dark.webp" />
      </Head>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div className="bg-[#010208]">
        <LandingHero />
        {FEATURED_MISSION && (
          <FeaturedMissionSection missions={missions} featuredMissionData={featuredMissionData} />
        )}
        <MissionStory />
        <PillarsSection />
        <GovernanceSection />
        <LaunchpadShowcase />
        <JourneyTimeline />
        <VoicesSection />
        <PartnersMarquee />
        <FinalCTA />
        <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
      </div>
    </Container>
  )
}
