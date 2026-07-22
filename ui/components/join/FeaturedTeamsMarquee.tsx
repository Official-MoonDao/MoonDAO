import Link from 'next/link'
import AdaptiveImage from '@/components/layout/AdaptiveImage'
import Reveal from '@/components/home/landing/Reveal'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'

export type FeaturedTeam = {
  id: string | number
  name: string
  image: string
}

function TeamCard({ team }: { team: FeaturedTeam }) {
  return (
    <Link
      href={`/team/${generatePrettyLink(team.name)}`}
      className="group flex w-40 flex-shrink-0 flex-col items-center gap-3 text-center md:w-48"
    >
      <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition-all duration-300 group-hover:ring-white/30 md:h-28 md:w-28">
        <AdaptiveImage
          src={team.image}
          alt={team.name}
          width={200}
          height={200}
          className="h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <h3 className="font-GoodTimes text-sm text-white md:text-base">{team.name}</h3>
    </Link>
  )
}

export default function FeaturedTeamsMarquee({ teams }: { teams: FeaturedTeam[] }) {
  if (!teams?.length) return null

  // Duplicate the list so the -50% translate loops seamlessly
  const doubled = [...teams, ...teams]

  return (
    <section className="relative overflow-hidden bg-[#010208] py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-5 md:px-10">
        <Reveal>
          <p className="text-center font-RobotoMono text-xs uppercase tracking-[0.35em] text-white/50">
            Teams in the Network
          </p>
        </Reveal>
        <div className="group relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#010208] to-transparent md:w-40" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#010208] to-transparent md:w-40" />
          <div className="flex w-max items-center gap-8 py-2 md:gap-12 motion-reduce:animate-none animate-marquee group-hover:[animation-play-state:paused]">
            {doubled.map((team, i) => (
              <TeamCard key={`${team.id}-${i}`} team={team} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
