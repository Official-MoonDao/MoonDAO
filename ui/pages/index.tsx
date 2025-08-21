import { useRouter } from 'next/router'
import { useContext, useEffect } from 'react'
import Head from 'next/head'
import CitizenContext from '@/lib/citizen/citizen-context'
import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import GovernanceSection from '../components/home/GovernanceSection'
import Hero from '../components/home/Hero'
import LaunchpadSection from '../components/home/LaunchpadSection'
import NetworkSection from '../components/home/NetworkSection'
import PartnerSection from '../components/home/PartnerSection'
import ProjectsSection from '../components/home/ProjectsSection'
import SpeakerSection from '../components/home/SpeakerSection'
import Timeline from '../components/home/Timeline'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import PageEnder from '../components/layout/PreFooter'

export default function Home({ linkSource }: any) {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)

  //If the user is loading the page directly and has a citizen nft, redirect to the home page
  useEffect(() => {
    if (
      linkSource === 'direct' &&
      citizen?.metadata?.name &&
      citizen?.metadata?.id
    )
      router.push('/home')
  }, [linkSource, citizen, router])

  return (
    <Container>
      <Head>
        {/* Preload critical background images */}
        <link rel="preload" as="image" href="/assets/Lunar-Colony-Dark.webp" />
        <link rel="preload" as="image" href="/assets/mission-hero-bg.webp" />
      </Head>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div>
        <Hero />
        <Callout1 />
        <Callout2 />
        <Feature />
        <LaunchpadSection />
        <GovernanceSection />
        <ProjectsSection />
        <NetworkSection />
        <Timeline />
        <SpeakerSection />
        <Callout3 />
        <PartnerSection />
        <PageEnder />
        <ExpandedFooter
          hasCallToAction={false}
          darkBackground={true}
          isFullwidth={true}
        />
      </div>
    </Container>
  )
}

export async function getServerSideProps(context: any) {
  const { req } = context
  const referer = req.headers.referer || req.headers.referrer

  let linkSource = 'direct'
  if (referer) {
    if (referer.startsWith(req.headers.host)) {
      linkSource = 'internal'
    } else {
      linkSource = 'external'
    }
  }

  return {
    props: { linkSource },
  }
}
