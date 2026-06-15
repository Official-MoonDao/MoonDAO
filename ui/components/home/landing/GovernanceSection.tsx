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
            title={
              <>
                Permissionless{' '}
                <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                  by Design
                </span>
              </>
            }
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
              className="group flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-left backdrop-blur-md transition-colors duration-300 hover:border-white/35 hover:bg-white/10"
            >
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#425EEB]/40 to-[#6C407D]/40 ring-1 ring-white/15">
                <Image
                  src="/assets/icon-copy.svg"
                  alt=""
                  width={18}
                  height={18}
                />
              </span>
              <span className="min-w-0">
                <span className="block font-RobotoMono text-[10px] uppercase tracking-[0.25em] text-white/50">
                  $MOONEY Token Contract
                </span>
                <span className="block truncate font-RobotoMono text-sm text-white/90 md:text-base">
                  {MOONEY_ADDRESS}
                </span>
              </span>
              <span className="ml-auto hidden font-RobotoMono text-xs uppercase tracking-widest text-white/40 transition-colors group-hover:text-white/80 sm:block">
                Copy
              </span>
            </button>
          </Reveal>

          <Reveal delay={0.35}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <CtaButton href="/get-mooney" variant="primary">
                Buy $MOONEY
              </CtaButton>
              <CtaButton href="/constitution" variant="secondary">
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
                className="group relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-white/30 hover:shadow-[0_25px_70px_-25px_rgba(124,140,255,0.55)]"
              >
                <div className="rounded-full bg-gradient-to-br from-[#3044A9] to-[#743F72] p-1 transition-transform duration-500 group-hover:scale-105">
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
                  <p className="mt-1 text-sm text-white/65">
                    {astronaut.subtitle}
                  </p>
                  <p className="mt-3 font-RobotoMono text-[10px] uppercase tracking-[0.2em] text-[#7c8cff]">
                    {astronaut.flight}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 font-RobotoMono text-[10px] uppercase tracking-[0.25em] text-white/40 transition-colors duration-300 group-hover:text-white/90">
                  Watch the flight
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
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
