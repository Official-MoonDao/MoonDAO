import Image from 'next/image'
import Link from 'next/link'
import Reveal from './Reveal'

type Logo = {
  alt: string
  logo: string
  link: string
  external?: boolean
}

const partners: Logo[] = [
  { alt: 'Blue Origin', logo: '/assets/logo-blue-origin.svg', link: '/network' },
  {
    alt: 'Intuitive Machines',
    logo: '/assets/logo-intuitive-machines.svg',
    link: '/network',
  },
  {
    alt: 'Earthlight Foundation',
    logo: '/assets/logo-earthlight-foundation.svg',
    link: '/network',
  },
  { alt: 'Open Lunar', logo: '/assets/logo-openlunar.svg', link: '/network' },
  { alt: 'Lifeship', logo: '/assets/logo-lifeship.svg', link: '/network' },
  { alt: 'DeSci Labs', logo: '/assets/logo-desci-labs.svg', link: '/network' },
  { alt: 'CryoDAO', logo: '/assets/logo-cryodao.svg', link: '/network' },
]

const press: Logo[] = [
  {
    alt: 'Space.com',
    logo: '/assets/logo-spacedotcom.svg',
    link: 'https://www.space.com/blue-origin-eiman-jahangir-suborbital-flight-moondao',
    external: true,
  },
  {
    alt: 'Forbes',
    logo: '/assets/logo-forbes.svg',
    link: 'https://www.forbes.com/sites/zengernews/2022/11/09/the-crypto-community-thats-going-to-the-moonliterally/?sh=119bc18670f0',
    external: true,
  },
  {
    alt: 'VICE',
    logo: '/assets/logo-vice.svg',
    link: 'https://www.vice.com/en/article/4aw4wj/investors-in-moondao-think-theyll-go-to-space-on-a-billionaires-rocket',
    external: true,
  },
  {
    alt: 'CNET',
    logo: '/assets/logo-cnet.svg',
    link: 'https://www.cnet.com/science/space/moondao-will-pick-2-of-the-next-blue-origin-astronauts-with-the-help-of-nfts/',
    external: true,
  },
  {
    alt: 'Houston Chronicle',
    logo: '/assets/logo-houston-chronicle.svg',
    link: 'https://www.houstonchronicle.com/news/houston-texas/space/article/cryptocurrency-blockchain-space-overlap-17753964.php',
    external: true,
  },
  {
    alt: 'Phys.org',
    logo: '/assets/logo-phys.svg',
    link: 'https://phys.org/news/2022-08-co-founder-texas-based-dude-space.html',
    external: true,
  },
  {
    alt: 'MSN',
    logo: '/assets/logo-msn.svg',
    link: 'https://www.msn.com/en-us/money/other/representation-matters-vanderbilt-doctor-to-become-first-nashvillian-to-go-outer-space/ar-AA1oRGNM?ocid=BingNewsVerp',
    external: true,
  },
]

function MarqueeRow({
  logos,
  reverse = false,
}: {
  logos: Logo[]
  reverse?: boolean
}) {
  // Duplicate the list so the -50% translate loops seamlessly
  const doubled = [...logos, ...logos]
  return (
    <div className="group relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#010208] to-transparent md:w-40" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#010208] to-transparent md:w-40" />
      <div
        className={`flex w-max items-center gap-16 py-6 md:gap-24 ${
          reverse ? 'animate-marquee-reverse' : 'animate-marquee'
        } group-hover:[animation-play-state:paused]`}
      >
        {doubled.map((logo, i) => (
          <Link
            key={`${logo.alt}-${i}`}
            href={logo.link}
            target={logo.external ? '_blank' : undefined}
            rel={logo.external ? 'noopener noreferrer' : undefined}
            className="flex-shrink-0 opacity-50 brightness-0 invert transition-opacity duration-300 hover:opacity-100"
            aria-label={logo.alt}
          >
            <Image
              src={logo.logo}
              alt={logo.alt}
              width={150}
              height={48}
              className="h-9 w-auto max-w-[160px] object-contain md:h-11"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function PartnersMarquee() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#010208] py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-5 md:px-10">
        <Reveal>
          <p className="text-center font-RobotoMono text-xs uppercase tracking-[0.35em] text-white/50">
            Our Network
          </p>
        </Reveal>
        <MarqueeRow logos={partners} />
        <Reveal>
          <p className="mt-4 text-center font-RobotoMono text-xs uppercase tracking-[0.35em] text-white/50">
            As Featured On
          </p>
        </Reveal>
        <MarqueeRow logos={press} reverse />
      </div>
    </section>
  )
}
