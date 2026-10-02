import CitizenABI from 'const/abis/Citizen.json'
import { CITIZEN_ADDRESSES, DEFAULT_CHAIN_V5 } from 'const/config'
import Image from 'next/image'
import { getChainSlug } from '@/lib/thirdweb/chain'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'
import CountUp from '@/components/home/landing/CountUp'
import CtaButton from '@/components/home/landing/CtaButton'
import Reveal from '@/components/home/landing/Reveal'
import Starfield from '@/components/home/landing/Starfield'

type JoinHeroProps = {
  citizenCount: number | null
  teamCount: number
}

function supplyToNumber(supply: unknown): number | null {
  if (supply == null) return null
  const count = Number(
    typeof supply === 'bigint' ||
      (typeof supply === 'object' && supply !== null && 'toString' in supply)
      ? (supply as { toString: () => string }).toString()
      : supply
  )
  return Number.isFinite(count) && count >= 0 ? count : null
}

export default function JoinHero({ citizenCount, teamCount }: JoinHeroProps) {
  const hasServerSupply = typeof citizenCount === 'number' && citizenCount > 0
  const chainSlug = getChainSlug(DEFAULT_CHAIN_V5)
  const citizenContract = useContract({
    chain: DEFAULT_CHAIN_V5,
    address: hasServerSupply ? '' : CITIZEN_ADDRESSES[chainSlug] || '',
    abi: CitizenABI,
  })
  // Only hit the chain in the browser when getStaticProps could not read
  // totalSupply. A missing read must not fall back to the filtered directory count.
  // A null param keeps useRead from firing while a server count is already in hand.
  const { data: supply } = useRead({
    contract: citizenContract,
    method: 'totalSupply',
    params: hasServerSupply ? [null] : [],
  })
  const mintedSupply = hasServerSupply ? citizenCount : supplyToNumber(supply)

  const stats: {
    value: number | null
    prefix?: string
    suffix?: string
    label: string
  }[] = [
    { value: mintedSupply, suffix: '+', label: 'Citizens' },
    { value: teamCount, suffix: '+', label: 'Teams' },
    { value: 8, prefix: '$', suffix: 'M+', label: 'Raised onchain' },
    { value: 2, suffix: '', label: 'Astronauts sent to space' },
  ]

  return (
    <>
      <section className="relative flex h-[100svh] w-full flex-col overflow-hidden bg-[#010208]">
        <div className="absolute inset-0 scale-[1.1]">
          <Image
            src="/assets/NetworkHero.webp"
            alt="Space Acceleration Network"
            fill
            priority
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/80 via-[#010208]/35 to-[#010208]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(66,94,235,0.28),transparent_60%)]" />
        <Starfield className="opacity-70" />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-24 text-center md:px-10">
          <Reveal>
            <h1 className="font-GoodTimes leading-[1.1] text-white text-4xl md:text-6xl 2xl:text-7xl drop-shadow-lg">
              Join the Space Acceleration Network
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/85 md:text-xl drop-shadow-lg">
              An onchain startup society funding, training, and flying everyday people to space —
              governed by its members, transparent by design.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CtaButton href="/citizen" variant="primary">
                Become a Citizen
              </CtaButton>
              <CtaButton href="/team" variant="secondary">
                Create a Team
              </CtaButton>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="relative z-10 border-t border-white/10 bg-[#010208]">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 divide-x divide-white/10 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal
              key={stat.label}
              delay={i * 0.08}
              className={`flex flex-col items-center gap-1 px-4 py-5 md:py-7 ${
                i >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              }`}
            >
              {stat.value == null ? (
                <span className="font-GoodTimes text-2xl text-white md:text-4xl">—</span>
              ) : (
                <CountUp
                  to={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  className="font-GoodTimes text-2xl text-white md:text-4xl"
                />
              )}
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.2em] text-white/50 md:text-xs">
                {stat.label}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  )
}
