import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import { testimonials as testimonialsContent } from 'const/joinPageContent'
import type { TestimonialWithPhoto, WhyJoinPillar } from 'const/joinPageContent'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { getContract, readContract } from 'thirdweb'
import { pixelViewContent } from '@/lib/analytics/metaPixel'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { loadJoinSocialProof } from '@/lib/join/socialProof'
import { useCitizenCheckoutLive, usePublicYearEth } from '@/lib/subscription/citizenCheckout'
import {
  displayedYearUsd,
  FALLBACK_CITIZEN_YEAR_USD,
  formatYearlyUsd,
} from '@/lib/subscription/publicYearPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import CitizenOfferCard from '@/components/citizenship/CitizenOfferCard'
import StickyJoinBar from '@/components/citizenship/StickyJoinBar'
import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'
import type { FeaturedCitizen } from '@/components/join/FeaturedCitizensMarquee'
import type { FeaturedTeam } from '@/components/join/FeaturedTeamsMarquee'
import JoinHero from '@/components/join/JoinHero'
import AdaptiveImage from '@/components/layout/AdaptiveImage'
import FAQs from '@/components/layout/FAQs'
import Head from '@/components/layout/Head'
import { SectionSkeleton } from '@/components/layout/SkeletonLoader'

// Same sections and styling as /join, so a visitor from an ad sees the same
// MoonDAO they would find on the main site.
const FeaturedCitizensMarquee = dynamic(() => import('@/components/join/FeaturedCitizensMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})
const FeaturedTeamsMarquee = dynamic(() => import('@/components/join/FeaturedTeamsMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})
const WhyJoinSection = dynamic(() => import('@/components/join/WhyJoinSection'), {
  loading: () => <SectionSkeleton />,
})
const TestimonialsCarousel = dynamic(() => import('@/components/join/TestimonialsCarousel'), {
  loading: () => <SectionSkeleton />,
})
const InlineJoinCTA = dynamic(() => import('@/components/join/InlineJoinCTA'), {
  loading: () => <SectionSkeleton minHeight="min-h-[200px]" />,
})

/**
 * Landing page for paid campaigns. One action: every button and card goes to
 * checkout, and there is no site navigation (see the chromeless list in
 * components/layout/Layout.tsx). Not indexed. Each ad angle is its own static
 * page (/citizenship, /citizenship/decide, /citizenship/people) so the hero
 * repeats the ad's hook with no flash or hidden headline.
 */
const JOIN_HREF = '/citizen'

const HEADLINES: Record<string, { title: string; sub: string }> = {
  default: {
    title: "Help decide what's next in space",
    sub: 'Join astronauts, scientists, and space builders as a MoonDAO Citizen. Pitch your space project for funding, compete to fly with Frank White, and access training and spaceflight opportunities.',
  },
  decide: {
    title: 'Who decides what we build on the Moon?',
    sub: 'MoonDAO Citizens do. Join astronauts, scientists, and space builders voting on which space projects get funded.',
  },
  people: {
    title: "Space isn't a spectator sport",
    sub: 'Join astronauts, scientists, and space builders as a MoonDAO Citizen. Pitch your space project for funding, compete to fly with Frank White, and access training and spaceflight opportunities.',
  },
}

const PILLARS: WhyJoinPillar[] = [
  {
    icon: '/assets/icon-astronaut.svg',
    iconAlt: 'Spaceflight',
    header: 'Training and spaceflight opportunities',
    paragraph:
      'MoonDAO has sent two Citizens to space, and members have flown Zero-G and traveled to launches. Citizens are eligible to apply when new opportunities open.',
  },
  {
    icon: '/assets/icon-crowdfunding.svg',
    iconAlt: 'Funding',
    header: 'Get funding for your space project',
    paragraph:
      'Submit a proposal and pitch the community directly. Skip the grant cycle: Citizen projects can be funded in weeks, not years.',
  },
  {
    icon: '/assets/icon-lander.svg',
    iconAlt: 'Fly with Frank',
    header: 'Compete to fly with Frank',
    paragraph:
      'Citizens can enter the competition for a seat beside Frank White, author of The Overview Effect.',
  },
  {
    icon: '/assets/icon-governance.svg',
    iconAlt: 'Voting',
    header: 'Vote on what gets funded',
    paragraph: 'Citizens decide which space projects the community funds.',
  },
  {
    icon: '/assets/icon-job.svg',
    iconAlt: 'Jobs',
    header: 'Citizens-only space jobs',
    paragraph:
      'Teams across the space industry post roles on the MoonDAO jobs board. Citizens can read every role and apply directly.',
  },
  {
    icon: '/assets/icon-globe.svg',
    iconAlt: 'Network',
    header: 'Meet the people building space',
    paragraph:
      'Connect with astronauts, scientists, founders, and teams across the space industry.',
  },
]

const OFFER_BENEFITS = [
  'Eligible for training & spaceflight opportunities',
  'Submit proposals and get your project funded',
  'Enter the competition to fly with Frank',
  'Vote on which space projects get funded',
  'Apply to citizens-only space jobs',
]

const STEPS = [
  {
    title: 'Join in about two minutes',
    body: 'Pay with Apple Pay, Google Pay, or a debit card.',
  },
  {
    title: 'Create your Citizen profile',
    body: 'Add your photo and a short bio so the network can find you.',
  },
  {
    title: 'Get involved',
    body: 'Vote on proposals, apply for roles, and hear about new opportunities.',
  },
]

const FAQ = [
  {
    question: 'What is MoonDAO?',
    answer:
      'A global, member-run space organization. Its Citizens decide which space projects get funded, and its network includes astronauts, scientists, and teams across the space industry.',
  },
  {
    question: 'Will I go to space?',
    answer:
      'Citizenship does not include a flight. It makes you eligible to apply for training and spaceflight opportunities when they open. MoonDAO has sent two Citizens to space so far.',
  },
  {
    question: 'What do I get this year?',
    answer:
      'Twelve months of Citizenship: you can submit proposals for funding, vote on what gets funded, enter the competition to fly with Frank, apply to citizens-only roles on the jobs board, and apply for training and spaceflight opportunities.',
  },
  {
    question: 'How do I get my project funded?',
    answer:
      'Submit a proposal describing your project and what it needs. Citizens review and vote on proposals, and approved projects receive community funding.',
  },
  {
    question: 'What is Fly with Frank?',
    answer:
      'Frank White, author of The Overview Effect, is flying with MoonDAO, and the community is working to send a Citizen with him. Citizenship is required to enter the competition for that seat.',
  },
  {
    question: 'Does it renew automatically?',
    answer: 'No. Citizenship lasts 12 months, and you can choose to renew when it ends.',
  },
  {
    question: 'Can I join from outside the United States?',
    answer:
      'Yes. MoonDAO has Citizens in over 38 countries. Citizenship is not yet available in the European Union or the United Kingdom.',
  },
]

type CitizenshipProps = {
  angle: string
  citizenCount: number | null
  teamCount: number
  citizenYearUsd: number
  featuredCitizens?: FeaturedCitizen[]
  featuredTeams?: FeaturedTeam[]
  testimonials?: TestimonialWithPhoto[]
}

export default function Citizenship({
  angle = 'default',
  citizenCount = null,
  teamCount = 0,
  citizenYearUsd = FALLBACK_CITIZEN_YEAR_USD,
  featuredCitizens = [],
  featuredTeams = [],
  testimonials = testimonialsContent,
}: CitizenshipProps) {
  const headline = HEADLINES[angle] || HEADLINES.default
  const frank = featuredCitizens.find((citizen) => /overview effect/i.test(citizen.role))

  const citizenPriceEth = usePublicYearEth('citizen')
  const cardCheckoutLive = useCitizenCheckoutLive()
  const { data: citizenUsdLive } = useETHPrice(
    citizenPriceEth != null && citizenPriceEth > 0 ? citizenPriceEth : 0,
    'ETH_TO_USD'
  )
  const citizenUsd = displayedYearUsd(citizenUsdLive, citizenYearUsd, FALLBACK_CITIZEN_YEAR_USD)
  const price = formatYearlyUsd(citizenUsd, FALLBACK_CITIZEN_YEAR_USD)

  const heroRef = useRef<HTMLDivElement>(null)
  const offerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    pixelViewContent('Citizenship landing')
  }, [])

  return (
    <section id="citizenship-container" className="overflow-hidden bg-[#010208] pb-20 md:pb-0">
      <Head
        title="Become a MoonDAO Citizen"
        description="Join astronauts, scientists, and space builders. Vote on which space projects get funded and become eligible for training and spaceflight opportunities."
        robots="noindex, nofollow"
      >
        <link rel="preload" as="image" href="/assets/NetworkHero.webp" />
      </Head>

      <div ref={heroRef} className="relative">
        <JoinHero
          citizenCount={citizenCount}
          teamCount={teamCount}
          showTeamCta={false}
          eyebrow={
            <Image
              src="/Original_White.png"
              alt="MoonDAO"
              width={1232}
              height={345}
              priority
              className="h-auto w-32 md:w-36"
            />
          }
          title={headline.title}
          subtitle={headline.sub}
          belowCtas={
            <p className="text-sm text-white/75">
              <span className="font-semibold text-white">{price}</span>
              {cardCheckoutLive ? ' · Apple Pay, Google Pay, or debit card' : ' · 12 months'}
            </p>
          }
          stats={(citizens, teams) => [
            { value: citizens, suffix: '+', label: 'Citizens' },
            { value: teams > 0 ? teams : null, suffix: '+', label: 'Teams' },
            { value: 2, label: 'Astronauts sent to space' },
            { value: 8, prefix: '$', suffix: 'M+', label: 'Raised for space' },
          ]}
        />
      </div>

      <FeaturedCitizensMarquee citizens={featuredCitizens} cardHref={JOIN_HREF} />

      <FeaturedTeamsMarquee teams={featuredTeams} cardHref={JOIN_HREF} />

      <section
        data-cta-location="paid_landing_frank"
        className="relative overflow-hidden bg-[#010208] py-20 md:py-28"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(249,185,92,0.12),transparent_60%)]" />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center md:flex-row md:text-left">
          {frank?.image && (
            <Reveal className="shrink-0">
              <div className="rounded-full bg-gradient-to-br from-[#F9B95C] to-[#743F72] p-[3px]">
                <AdaptiveImage
                  src={frank.image}
                  alt={frank.name}
                  width={320}
                  height={320}
                  className="h-40 w-40 rounded-full object-cover md:h-52 md:w-52"
                />
              </div>
            </Reveal>
          )}
          <div className="flex flex-col items-center gap-5 md:items-start">
            <Reveal>
              <span className="inline-flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.28em] text-moon-gold">
                <span className="h-px w-6 bg-moon-gold/70" />
                Fly with Frank
              </span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="font-heading text-2xl font-semibold leading-[1.15] text-white md:text-4xl">
                Compete for the seat beside Frank White
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
                Frank White, author of <em>The Overview Effect</em>, is flying with MoonDAO, and the
                community is working to send a Citizen with him. Citizenship is required to enter
                the competition for that seat.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <CtaButton href={JOIN_HREF} variant="primary">
                Become a Citizen
              </CtaButton>
            </Reveal>
          </div>
        </div>
      </section>

      <WhyJoinSection
        eyebrow="What you get"
        title={
          <>
            More than a membership.{' '}
            <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
              A place in space.
            </span>
          </>
        }
        description="Citizenship puts you inside the network of people and teams building humanity's future in space."
        pillars={PILLARS}
      />

      <TestimonialsCarousel testimonials={testimonials} />

      <section className="relative bg-[#010208] py-20 md:py-28">
        <div className="mx-auto w-full max-w-[1100px] px-5 md:px-10">
          <SectionHeading eyebrow="How it works" title="Three steps to Citizenship" />
          <ol className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={0.08 * i} className="h-full">
                <li className="flex h-full flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-md md:p-8">
                  <span className="font-RobotoMono text-xs uppercase tracking-[0.28em] text-moon-gold">
                    Step {i + 1}
                  </span>
                  <h3 className="font-heading text-lg font-semibold text-white md:text-xl">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/65 md:text-base">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <CitizenOfferCard
        ref={offerRef}
        price={price}
        cardCheckoutLive={cardCheckoutLive}
        href={JOIN_HREF}
        benefits={OFFER_BENEFITS}
      />

      <section className="bg-[#010208] py-20 md:py-28">
        <div className="mx-auto w-full max-w-3xl px-5 text-white md:px-10">
          <SectionHeading eyebrow="Questions" title="Before you join" />
          <div className="mt-6">
            <FAQs faqs={FAQ} />
          </div>
        </div>
      </section>

      <InlineJoinCTA
        headline="Ready to become a Citizen?"
        subtext={`12-month Citizenship · ${price} · No automatic renewal`}
      />

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 bg-[#010208] px-6 py-8 text-xs text-white/50">
        <Link href="/privacy-policy" className="hover:text-white">
          Privacy Policy
        </Link>
        <Link href="/terms-of-service" className="hover:text-white">
          Terms of Service
        </Link>
        <Link href="/privacy-choices" className="hover:text-white">
          Do Not Sell or Share My Personal Information
        </Link>
      </footer>

      <StickyJoinBar price={price} href={JOIN_HREF} showAfter={heroRef} hideWhile={offerRef} />
    </section>
  )
}

async function readCitizenTotalSupply(): Promise<number | null> {
  const address = CITIZEN_ADDRESSES[getChainSlug(DEFAULT_CHAIN_V5)]
  if (!address) return null
  try {
    const supply = await readContract({
      contract: getContract({
        client: serverClient,
        address,
        chain: DEFAULT_CHAIN_V5,
        abi: CitizenABI as any,
      }),
      method: 'totalSupply' as string,
      params: [],
    })
    const count = Number((supply as any)?.toString?.() ?? supply)
    return Number.isFinite(count) && count >= 0 ? count : null
  } catch (error) {
    console.error('Error reading citizen totalSupply:', error)
    return null
  }
}

export async function getStaticPaths() {
  return {
    paths: Object.keys(HEADLINES).map((angle) => ({
      params: { angle: angle === 'default' ? [] : [angle] },
    })),
    fallback: false,
  }
}

export async function getStaticProps({ params }: { params: { angle?: string[] } }) {
  const angle = params?.angle?.[0] || 'default'
  const { readPublicYearlyUsd } = await import('@/lib/subscription/readPublicYearUsd')
  const [citizenCount, yearlyUsd, socialProof] = await Promise.all([
    readCitizenTotalSupply(),
    readPublicYearlyUsd(),
    loadJoinSocialProof(DEFAULT_CHAIN_V5),
  ])
  return {
    props: {
      angle,
      citizenCount,
      teamCount: socialProof.activeTeamCount,
      citizenYearUsd: yearlyUsd.citizenYearUsd,
      featuredCitizens: socialProof.featuredCitizens,
      featuredTeams: socialProof.featuredTeams,
      testimonials: socialProof.testimonials,
    },
    revalidate: 60,
  }
}
