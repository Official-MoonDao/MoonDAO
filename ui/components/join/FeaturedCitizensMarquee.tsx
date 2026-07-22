import Link from 'next/link'
import AdaptiveImage from '@/components/layout/AdaptiveImage'
import Reveal from '@/components/home/landing/Reveal'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'

export type FeaturedCitizen = {
  id: string | number
  name: string
  image: string
  role: string
}

function CitizenCard({ citizen }: { citizen: FeaturedCitizen }) {
  return (
    <Link
      href={`/citizen/${generatePrettyLinkWithId(citizen.name, citizen.id)}`}
      className="group flex w-40 flex-shrink-0 flex-col items-center gap-3 text-center md:w-48"
    >
      <div className="relative">
        <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#425EEB]/0 to-[#6C407D]/0 blur-xl transition-all duration-500 group-hover:from-[#425EEB]/40 group-hover:to-[#6C407D]/40" />
        <div className="relative rounded-full bg-gradient-to-br from-[#3044A9] to-[#743F72] p-[3px]">
          <AdaptiveImage
            src={citizen.image}
            alt={citizen.name}
            width={200}
            height={200}
            className="h-24 w-24 rounded-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-32 md:w-32"
          />
        </div>
      </div>
      <div>
        <h3 className="font-GoodTimes text-sm text-white md:text-base">{citizen.name}</h3>
        <p className="mt-1 text-xs text-white/60 md:text-sm">{citizen.role}</p>
      </div>
    </Link>
  )
}

export default function FeaturedCitizensMarquee({
  citizens,
}: {
  citizens: FeaturedCitizen[]
}) {
  if (!citizens?.length) return null

  // Duplicate the list so the -50% translate loops seamlessly
  const doubled = [...citizens, ...citizens]

  return (
    <section className="relative overflow-hidden bg-[#010208] py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-5 md:px-10">
        <Reveal>
          <p className="text-center font-RobotoMono text-xs uppercase tracking-[0.35em] text-white/50">
            Featured Citizens
          </p>
        </Reveal>
        <div className="group relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#010208] to-transparent md:w-40" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#010208] to-transparent md:w-40" />
          <div className="flex w-max items-center gap-8 py-2 md:gap-12 motion-reduce:animate-none animate-marquee-reverse group-hover:[animation-play-state:paused]">
            {doubled.map((citizen, i) => (
              <CitizenCard key={`${citizen.id}-${i}`} citizen={citizen} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
