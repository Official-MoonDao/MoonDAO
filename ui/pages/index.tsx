import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import CitizenContext from '@/lib/citizen/citizen-context'
import { getAllCitizenLocationData } from '@/lib/subscription/getAllCitizenLocationData'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import Callout1 from '../components/home/Callout1'
import Callout2 from '../components/home/Callout2'
import Callout3 from '../components/home/Callout3'
import Feature from '../components/home/Feature'
import Hero from '../components/home/Hero'
import PartnerSection from '../components/home/PartnerSection'
import SpeakerSection from '../components/home/SpeakerSection'
import Video from '../components/home/Video'
import Container from '../components/layout/Container'
import Footer from '../components/layout/Footer'
import WebsiteHead from '../components/layout/Head'
import PageEnder from '../components/layout/PreFooter'
import MoonSection from '@/components/home/MoonSection'

export default function Home({ citizenLocationData }: any) {
  const router = useRouter()
  const { citizen } = useContext(CitizenContext)
  const [isMounted, setIsMounted] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    setIsMounted(true)

    const handleRouteChange = () => {
      setIsInitialLoad(false)
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router])

  //If the user is loading the page directly and has a citizen nft, redirect to their citizen page
  useEffect(() => {
    if (
      isMounted &&
      process.env.NEXT_PUBLIC_ENV === 'prod' &&
      isInitialLoad &&
      !document.referrer.includes(window.location.host) &&
      citizen?.metadata?.name &&
      citizen?.metadata?.id
    ) {
      router.push(
        `/citizen/${generatePrettyLinkWithId(
          citizen?.metadata?.name as string,
          citizen?.metadata?.id
        )}`
      )
    }
  }, [isMounted, isInitialLoad, citizen, router])

  return (
    <Container>
      <WebsiteHead
        title="Welcome"
        description="MoonDAO is accelerating our multiplanetary future with an open platform to fund, collaborate, and compete on challenges that get us closer to a lunar settlement."
      />
      <div>
        <Hero citizenLocationData={citizenLocationData} />
        <Video />
        <Callout1 />
        <MoonSection />
        <Callout2 />
        <Feature />
        <SpeakerSection />
        <Callout3 />
        <PartnerSection />
        <PageEnder />
        <Footer darkBackground={true} />
      </div>
    </Container>
  )
}

export async function getStaticProps(context: any) {
  const citizenLocationData = await getAllCitizenLocationData()

  return {
    props: { citizenLocationData },
    revalidate: 60,
  }
}
