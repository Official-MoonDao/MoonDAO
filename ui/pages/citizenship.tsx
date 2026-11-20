import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import {
  JOIN_FILM_VIMEO_ID,
  joinFilm,
  testimonials as testimonialsContent,
} from 'const/joinPageContent'
import type { TestimonialWithPhoto } from 'const/joinPageContent'
import useTranslation from 'next-translate/useTranslation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { getContract, readContract } from 'thirdweb'
import { pixelViewContent } from '@/lib/analytics/metaPixel'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { loadJoinSocialProof } from '@/lib/join/socialProof'
import { resolveCitizenCount } from '@/lib/stats/publicFigures'
import { useCitizenCheckoutLive, usePublicYearEth } from '@/lib/subscription/citizenCheckout'
import {
  displayedYearUsd,
  FALLBACK_CITIZEN_YEAR_USD,
  formatYearlyUsd,
} from '@/lib/subscription/publicYearPrice'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { serverClient } from '@/lib/thirdweb/serverClient'
import CtaButton from '@/components/home/landing/CtaButton'
import Starfield from '@/components/home/landing/Starfield'
import type { FeaturedCitizen } from '@/components/join/FeaturedCitizensMarquee'
import type { FeaturedTeam } from '@/components/join/FeaturedTeamsMarquee'
import FilmPlayer from '@/components/layout/FilmPlayer'
import Head from '@/components/layout/Head'
import { SectionSkeleton } from '@/components/layout/SkeletonLoader'

const TestimonialsCarousel = dynamic(() => import('@/components/join/TestimonialsCarousel'), {
  loading: () => <SectionSkeleton />,
})
const FeaturedCitizensMarquee = dynamic(() => import('@/components/join/FeaturedCitizensMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})
const FeaturedTeamsMarquee = dynamic(() => import('@/components/join/FeaturedTeamsMarquee'), {
  loading: () => <SectionSkeleton minHeight="min-h-[300px]" />,
})

// Every card and button on this page goes to checkout. Nothing leads off into
// profiles, team pages, or the rest of the site.
const JOIN_HREF = '/citizen'

/**
 * Landing page for paid campaigns: one offer, one action, no site navigation
 * (see the chromeless list in components/layout/Layout.tsx). Not indexed.
 * `?angle=` swaps the headline so each ad lands on a page that repeats its hook.
 */
const HEADLINES: Record<string, { title: string; sub: string }> = {
  default: {
    title: 'A space program run by its members',
    sub: 'MoonDAO Citizens vote on which space projects the community funds, get access to training and spaceflight opportunities, and apply to citizens-only space jobs.',
  },
  decide: {
    title: 'Who decides what we build on the Moon?',
    sub: 'MoonDAO Citizens do. Vote on which space projects the community funds, and get access to training and spaceflight opportunities.',
  },
  people: {
    title: "Space isn't a spectator sport",
    sub: 'Join astronauts, scientists, and space fans who fund real space projects, with access to training and spaceflight opportunities.',
  },
}

const BENEFITS = [
  {
    title: 'Training and spaceflight opportunities',
    body: 'Citizens are eligible for training and spaceflight opportunities, from Zero-G flights to launch trips, as they open up.',
  },
  {
    title: 'Vote on what we fund',
    body: 'Citizens decide which space projects receive community funding.',
  },
  {
    title: 'Apply to space jobs',
    body: 'Read every role on the jobs board and apply as a Citizen.',
  },
]

const FAQ = [
  {
    q: 'What is a Citizen?',
    a: 'A member of MoonDAO. Citizenship lasts 12 months. Citizens vote on what the community funds, are eligible for training and spaceflight opportunities, and can apply to citizens-only roles.',
  },
  {
    q: 'Who are the Citizens?',
    a: 'Astronauts, scientists, engineers, founders, and space fans from around the world, alongside the space organizations in our network.',
  },
  {
    q: 'How do I pay?',
    a: 'Pay with Apple Pay, Google Pay, or a debit card. It takes a couple of minutes.',
  },
  {
    q: 'Is Citizenship an investment?',
    a: 'No. Citizenship is a membership. Join for what you can do as a Citizen, not for a financial return.',
  },
]

type CitizenshipProps = {
  citizenCount: number | null
  citizenYearUsd: number
  featuredCitizens?: FeaturedCitizen[]
  featuredTeams?: FeaturedTeam[]
  testimonials?: TestimonialWithPhoto[]
}

export default function Citizenship({
  citizenCount = null,
  citizenYearUsd = FALLBACK_CITIZEN_YEAR_USD,
  featuredCitizens = [],
  featuredTeams = [],
  testimonials = testimonialsContent,
}: CitizenshipProps) {
  const { t } = useTranslation('common')
  const router = useRouter()
  const angle = typeof router.query.angle === 'string' ? router.query.angle : 'default'
  const headline = HEADLINES[angle] || HEADLINES.default

  const citizenPriceEth = usePublicYearEth('citizen')
  const cardCheckoutLive = useCitizenCheckoutLive()
  const { data: citizenUsdLive } = useETHPrice(
    citizenPriceEth != null && citizenPriceEth > 0 ? citizenPriceEth : 0,
    'ETH_TO_USD'
  )
  const citizenUsd = displayedYearUsd(citizenUsdLive, citizenYearUsd, FALLBACK_CITIZEN_YEAR_USD)
  const price = formatYearlyUsd(citizenUsd, FALLBACK_CITIZEN_YEAR_USD)
  const citizens = resolveCitizenCount(citizenCount)

  useEffect(() => {
    pixelViewContent('Citizenship landing')
  }, [])

  const priceLine = (
    <p className="mt-4 text-sm text-white/75 md:text-base">
      <span className="font-semibold text-white">{price}</span>
      {cardCheckoutLive
        ? ' · Pay with Apple Pay, Google Pay, or a debit card'
        : ' · 12-month Citizenship'}
    </p>
  )

  return (
    <section className="min-h-screen overflow-hidden bg-[#010208] text-white">
      <Head
        title="Become a MoonDAO Citizen"
        description="A space program run by its members. Vote on which space projects the community funds and get access to training and spaceflight opportunities."
        robots="noindex, nofollow"
      />

      <section
        data-cta-location="paid_landing_hero"
        className="relative flex min-h-[100svh] w-full flex-col overflow-hidden"
      >
        <div className="absolute inset-0">
          <Image
            src="/assets/NetworkHero.webp"
            alt=""
            fill
            priority
            className="object-cover opacity-60"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/90 via-[#010208]/60 to-[#010208]" />
        <Starfield className="opacity-60" />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 text-center">
          <Image
            src="/Original_White.png"
            alt="MoonDAO"
            width={1232}
            height={345}
            className="mx-auto mb-10 h-auto w-40"
          />
          <h1
            className={`font-heading text-4xl font-semibold leading-[1.08] transition-opacity md:text-6xl ${
              router.isReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {headline.title}
          </h1>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85 transition-opacity md:text-xl ${
              router.isReady ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {headline.sub}
          </p>
          <div className="mt-10 flex flex-col items-center">
            <CtaButton href={JOIN_HREF} variant="primary">
              Become a Citizen
            </CtaButton>
            {priceLine}
          </div>
          <dl className="mx-auto mt-12 grid w-full max-w-md grid-cols-2 gap-6 text-center">
            <div>
              <dt className="text-xs uppercase tracking-widest text-white/50">Citizens</dt>
              <dd className="font-heading text-3xl font-semibold">
                {citizens != null ? `${citizens}+` : '...'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-white/50">
                People sent to space
              </dt>
              <dd className="font-heading text-3xl font-semibold">2</dd>
            </div>
          </dl>
        </div>
      </section>

      <FeaturedCitizensMarquee citizens={featuredCitizens} cardHref={JOIN_HREF} />

      <FeaturedTeamsMarquee teams={featuredTeams} cardHref={JOIN_HREF} />

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
            >
              <h2 className="font-heading text-xl font-semibold">{benefit.title}</h2>
              <p className="mt-3 text-white/70">{benefit.body}</p>
            </div>
          ))}
        </div>
      </section>

      {JOIN_FILM_VIMEO_ID && (
        <section className="mx-auto w-full max-w-4xl px-6 pb-16">
          <FilmPlayer
            vimeoId={JOIN_FILM_VIMEO_ID}
            film={joinFilm}
            playLabel={t('joinFilmPlay')}
            eventPrefix="paid_landing_film"
            endCard={{
              title: t('joinFilmEndTitle'),
              ctaLabel: t('joinFilmEndCta'),
              ctaHref: JOIN_HREF,
              replayLabel: t('filmReplay'),
            }}
            caption={
              <>
                <span className="font-semibold text-white/85">{t('joinFilmTitle')}</span> ·{' '}
                {t('joinFilmSub')}
              </>
            }
          />
        </section>
      )}

      <TestimonialsCarousel testimonials={testimonials} />

      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <h2 className="font-heading text-2xl font-semibold md:text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold text-white/90">
                {item.q}
              </summary>
              <p className="mt-3 text-white/70">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        data-cta-location="paid_landing_footer"
        className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-20 text-center"
      >
        <h2 className="font-heading text-3xl font-semibold">Ready to help decide?</h2>
        <div className="mt-8">
          <CtaButton href={JOIN_HREF} variant="primary">
            Become a Citizen
          </CtaButton>
        </div>
        {priceLine}
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 px-6 py-8 text-xs text-white/50">
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

export async function getStaticProps() {
  const { readPublicYearlyUsd } = await import('@/lib/subscription/readPublicYearUsd')
  const [citizenCount, yearlyUsd, socialProof] = await Promise.all([
    readCitizenTotalSupply(),
    readPublicYearlyUsd(),
    loadJoinSocialProof(DEFAULT_CHAIN_V5),
  ])
  return {
    props: {
      citizenCount,
      citizenYearUsd: yearlyUsd.citizenYearUsd,
      featuredCitizens: socialProof.featuredCitizens,
      featuredTeams: socialProof.featuredTeams,
      testimonials: socialProof.testimonials,
    },
    revalidate: 60,
  }
}
