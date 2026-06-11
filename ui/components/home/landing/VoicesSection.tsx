import Image from 'next/image'
import Link from 'next/link'
import Reveal from './Reveal'
import SectionHeading from './SectionHeading'

const speakers = [
  {
    name: 'Charlie Duke',
    subtitle: 'Apollo 16 Moonwalker',
    image: '/assets/Speaker-Charlie-Duke.png',
    link: 'https://www.youtube.com/watch?v=79dThcv3PdU',
  },
  {
    name: 'Doug Hurley',
    subtitle: 'NASA & SpaceX Astronaut',
    image: '/assets/Speaker-Doug-Hurley.png',
    link: 'https://www.youtube.com/watch?v=JLXwyZIOy5k',
  },
  {
    name: 'Nicole Stott',
    subtitle: 'NASA Astronaut',
    image: '/assets/Speaker-Nicole-Stott.png',
    link: 'https://www.youtube.com/watch?v=WwtP38hDSOc',
  },
  {
    name: 'Robert Zubrin',
    subtitle: 'Mars Society Founder',
    image: '/assets/Speaker-Robert-Zubrin.png',
    link: 'https://www.youtube.com/watch?v=_706XEfrWIo',
  },
  {
    name: 'Steve Altemus',
    subtitle: 'CEO, Intuitive Machines',
    image: '/assets/Speaker-Steve-Altemus.png',
    link: 'https://www.youtube.com/watch?v=xVQE0HPbbHw',
  },
  {
    name: 'Dr. Phil Metzger',
    subtitle: 'Planetary Physicist',
    image: '/assets/Speaker-Phil-Metzger.png',
    link: 'https://www.youtube.com/watch?v=jTt6wOJPTeQ',
  },
]

export default function VoicesSection() {
  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(108,64,125,0.16),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <SectionHeading
          eyebrow="Voices"
          title={
            <>
              Backed by People Who&apos;ve{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                Been There
              </span>
            </>
          }
          description="Moonwalkers, astronauts, and pioneers of the space industry have joined MoonDAO town halls to share what it takes to get there."
        />

        <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8 md:gap-y-14">
          {speakers.map((speaker, i) => (
            <Reveal key={speaker.name} delay={0.07 * (i % 3)}>
              <Link
                href={speaker.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-4 text-center"
              >
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#425EEB]/0 to-[#6C407D]/0 blur-xl transition-all duration-500 group-hover:from-[#425EEB]/40 group-hover:to-[#6C407D]/40" />
                  <div className="relative rounded-full bg-gradient-to-br from-[#3044A9] to-[#743F72] p-[3px]">
                    <Image
                      src={speaker.image}
                      alt={speaker.name}
                      width={300}
                      height={300}
                      className="h-28 w-28 rounded-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-40 md:w-40 lg:h-48 lg:w-48"
                    />
                  </div>
                  <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#010208]/90 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 md:h-10 md:w-10">
                    <svg
                      className="h-3.5 w-3.5 text-white md:h-4 md:w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
                <div>
                  <h3 className="font-GoodTimes text-sm text-white md:text-lg">
                    {speaker.name}
                  </h3>
                  <p className="mt-1 text-xs text-white/60 md:text-sm">
                    {speaker.subtitle}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
