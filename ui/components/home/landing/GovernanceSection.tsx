import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import CtaButton from './CtaButton'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const MOONEY_ADDRESS = '0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395'

const astronauts = [
  {
    name: 'Coby Cotton',
    subtitle: "MoonDAO's 1st Astronaut",
    image: '/assets/astronaut-coby.png',
    link: 'https://www.youtube.com/watch?v=YXXlSG-du7c',
    flight: 'Blue Origin NS-22 · Aug 2022',
  },
  {
    name: 'Dr. Eiman Jahangir',
    subtitle: "MoonDAO's 2nd Astronaut",
    image: '/assets/astronaut-eiman.png',
    link: 'https://www.youtube.com/watch?v=O8Z5HVXOwsk',
    flight: 'Blue Origin NS-26 · Aug 2024',
  },
]

export default function GovernanceSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      <div className="absolute inset-0">
        <Image
          src="/assets/mission-hero-bg.webp"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#010208]/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208] via-transparent to-[#010208]" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-16 px-5 md:px-10 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHeading
            align="left"
            eyebrow="Governance"
            title="Permissionless by Design"
            description="Everything at MoonDAO is proposed, governed, and created by its members. Lock $MOONEY to become a voter and co-govern the treasury — no gatekeepers, no permission needed."
          />

          <Reveal delay={0.25}>
            <button
              onClick={async () => {
                try {
                  if (!navigator.clipboard) {
                    throw new Error('Clipboard API unavailable')
                  }
                  await navigator.clipboard.writeText(MOONEY_ADDRESS)
                  toast.success('Address copied to clipboard.')
                } catch (err) {
                  toast.error('Could not copy address. Please copy it manually.')
                }
              }}
              className="group flex w-full max-w-xl items-center gap-4 border-t border-white/10 py-4 text-left transition-colors duration-300 hover:border-white/25"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-RobotoMono text-[10px] uppercase tracking-[0.22em] text-white/40">
                  $MOONEY contract
                </span>
                <span className="mt-1 block truncate font-RobotoMono text-sm text-white/75">
                  {MOONEY_ADDRESS}
                </span>
              </span>
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.18em] text-white/40 transition-colors group-hover:text-white">
                Copy
              </span>
            </button>
          </Reveal>

          <Reveal delay={0.35}>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              <CtaButton href="/get-mooney" variant="primary">
                Buy $MOONEY
              </CtaButton>
              <CtaButton href="/constitution" variant="quiet">
                Read the Constitution
              </CtaButton>
            </div>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {astronauts.map((astronaut, i) => (
            <Reveal key={astronaut.name} delay={0.15 + i * 0.15} y={40}>
              <Link
                href={astronaut.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center transition-colors duration-300 hover:border-white/20"
              >
                <div className="rounded-full ring-1 ring-white/20">
                  <Image
                    src={astronaut.image}
                    alt={astronaut.name}
                    width={220}
                    height={220}
                    className="h-36 w-36 rounded-full object-cover md:h-44 md:w-44"
                  />
                </div>
                <div>
                  <h3 className="font-GoodTimes text-base text-white md:text-lg">
                    {astronaut.name}
                  </h3>
                  <p className="mt-1 text-sm text-white/65">{astronaut.subtitle}</p>
                  <p className="mt-3 font-RobotoMono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    {astronaut.flight}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 font-RobotoMono text-[10px] uppercase tracking-[0.16em] text-white/35 transition-colors duration-300 group-hover:text-white/80">
                  Watch the flight
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
