import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { testimonials } from 'const/joinPageContent'
import dynamic from 'next/dynamic'
import { getContract, readContract } from 'thirdweb'
import useCitizenOffer from '@/lib/citizen/useCitizenOffer'
import { resolveCitizenCount } from '@/lib/stats/publicFigures'
import { FALLBACK_CITIZEN_YEAR_USD } from '@/lib/subscription/publicYearPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import DudePerfectHero from '../components/dude-perfect/DudePerfectHero'
import StickyCitizenBar from '../components/dude-perfect/StickyCitizenBar'
import Container from '../components/layout/Container'
import { ExpandedFooter } from '../components/layout/ExpandedFooter'
import WebsiteHead from '../components/layout/Head'
import { SectionSkeleton } from '../components/layout/SkeletonLoader'

const DudePerfectStory = dynamic(() => import('../components/dude-perfect/DudePerfectStory'), {
  loading: () => <SectionSkeleton />,
})
const WhatIsMoonDAO = dynamic(
  () => import('../components/dude-perfect/DudePerfectStory').then((m) => m.WhatIsMoonDAO),
  { loading: () => <SectionSkeleton /> }
)
const WhyJoinSection = dynamic(() => import('../components/join/WhyJoinSection'), {
  loading: () => <SectionSkeleton />,
})
const HowItWorks = dynamic(
  () => import('../components/dude-perfect/DudePerfectOffer').then((m) => m.HowItWorks),
  { loading: () => <SectionSkeleton /> }
)
const TestimonialsCarousel = dynamic(() => import('../components/join/TestimonialsCarousel'), {
  loading: () => <SectionSkeleton />,
})
const VoicesSection = dynamic(() => import('../components/home/landing/VoicesSection'), {
  loading: () => <SectionSkeleton />,
})
const OfferSection = dynamic(
  () => import('../components/dude-perfect/DudePerfectOffer').then((m) => m.OfferSection),
  { loading: () => <SectionSkeleton /> }
)
const StayInTheLoop = dynamic(() =>
  import('../components/dude-perfect/DudePerfectOffer').then((m) => m.StayInTheLoop)
)
const DudePerfectFAQ = dynamic(() => import('../components/dude-perfect/DudePerfectFAQ'), {
  loading: () => <SectionSkeleton />,
})
const DudePerfectFinalCTA = dynamic(
  () => import('../components/dude-perfect/DudePerfectFinalCTA'),
  { loading: () => <SectionSkeleton /> }
)

// Real citizen portraits come from the /join build; here only the astronaut has one on hand.
const pageTestimonials = testimonials.map((t) => ({
  ...t,
  image: t.name === 'Eiman' ? '/assets/astronaut-eiman.png' : null,
}))

type DudePerfectProps = {
  citizenYearUsd?: number
  citizenCount?: number | null
}

export default function DudePerfect({
  citizenYearUsd = FALLBACK_CITIZEN_YEAR_USD,
  citizenCount = null,
}: DudePerfectProps) {
  const offer = useCitizenOffer(citizenYearUsd)

  const title = 'We Sent Dude Perfect to Space. Become a MoonDAO Citizen.'
  const description =
    'Launching Coby Cotton to space was only the beginning. Become a MoonDAO citizen to fund space projects, vote on missions, earn rewards, and help build a lunar settlement.'
  const image = '/assets/dp-og.jpg'
  const keywords =
    'MoonDAO Dude Perfect, Dude Perfect, Coby Cotton, Blue Origin, astronaut, MoonDAO citizen, become a citizen'

  return (
    <Container>
      <WebsiteHead
        title={title}
        description={description}
        image={image}
        keywords={keywords}
        robots="index, follow, max-image-preview:large"
      />
      <div className="bg-[#010208]">
        <DudePerfectHero offer={offer} citizenCount={resolveCitizenCount(citizenCount)} />
        <DudePerfectStory />
        <WhatIsMoonDAO />
        <WhyJoinSection />
        <HowItWorks />
        <TestimonialsCarousel testimonials={pageTestimonials} />
        <VoicesSection />
        <OfferSection offer={offer} />
        <StayInTheLoop />
        <DudePerfectFAQ offer={offer} />
        <DudePerfectFinalCTA offer={offer} />
        <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
      </div>
      <StickyCitizenBar offer={offer} />
    </Container>
  )
}

async function readCitizenSupply(): Promise<number | null> {
  const chain = DEFAULT_CHAIN_V5
  const address = CITIZEN_ADDRESSES[getChainSlug(chain)]
  if (!address) return null
  try {
    const CitizenABI = (await import('const/abis/Citizen.json')).default
    const supply = await readContract({
      contract: getContract({ client: serverClient, address, chain, abi: CitizenABI as any }),
      method: 'totalSupply' as string,
      params: [],
    })
    const count = Number((supply as any)?.toString?.() ?? supply)
    return Number.isFinite(count) && count > 0 ? count : null
  } catch (error) {
    console.error('Error reading citizen totalSupply:', error)
    return null
  }
}

export async function getStaticProps() {
  const { readPublicYearlyUsd } = await import('@/lib/subscription/readPublicYearUsd')
  const [yearly, citizenCount] = await Promise.all([readPublicYearlyUsd(), readCitizenSupply()])

  return {
    props: {
      citizenYearUsd: yearly.citizenYearUsd,
      citizenCount,
    },
    revalidate: 300,
  }
}
