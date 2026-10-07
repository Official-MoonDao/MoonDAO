import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CameraIcon,
  PlayIcon,
  AtSymbolIcon,
  UserPlusIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'

type HubLink = {
  name: string
  description: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  /** HOLD entries stay in source but are not rendered. */
  hidden?: boolean
}

const HUB_LINKS: HubLink[] = [
  {
    name: 'Become a Citizen',
    description: 'Join the Space Acceleration Network',
    url: 'https://moondao.com/join?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-join',
    icon: UserPlusIcon,
  },
  {
    name: 'Send Frank to Space',
    description: 'The mission to fly with Frank White',
    url: 'https://moondao.com/frank?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-frank',
    icon: RocketLaunchIcon,
  },
  {
    name: 'Events and Town Hall',
    description: 'Gatherings for the MoonDAO community',
    url: 'https://moondao.com/events?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-events',
    icon: CalendarDaysIcon,
  },
  {
    name: 'Join our Discord',
    description: 'Talk with the MoonDAO community',
    url: 'https://moondao.com/discord?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-discord',
    icon: ChatBubbleLeftRightIcon,
  },
  // HOLD: not part of the current Instagram bio hub.
  {
    name: 'Documentation',
    description: 'Learn about our mission and governance',
    url: '/docs',
    icon: DocumentTextIcon,
    hidden: true,
  },
  {
    name: 'Instagram',
    description: 'Behind-the-scenes space content',
    url: '/instagram',
    icon: CameraIcon,
    hidden: true,
  },
  {
    name: 'Twitter/X',
    description: 'Daily updates and space news',
    url: '/twitter',
    icon: AtSymbolIcon,
    hidden: true,
  },
  {
    name: 'YouTube',
    description: 'Space missions and educational content',
    url: 'https://youtube.com/@officialmoondao',
    icon: PlayIcon,
    hidden: true,
  },
]

const LinkTree: React.FC = () => {
  const visibleLinks = HUB_LINKS.filter((link) => !link.hidden)

  return (
    <>
      <WebsiteHead
        title="MoonDAO"
        description="Become a Citizen, follow the mission to send Frank White to space, and find MoonDAO events and Discord."
      />
      <Container>
        <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-16 pt-8 sm:pt-12">
          <header className="mb-8 text-center">
            <Image
              src="/Original_White.png"
              alt="MoonDAO"
              width={88}
              height={88}
              className="mx-auto rounded-full border border-moon-gold/40"
            />
            <p className="mt-5 font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-moon-gold">
              Space Acceleration Network
            </p>
            <h1 className="mt-3 font-GoodTimes text-3xl text-white sm:text-4xl">
              MoonDAO
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-300">
              A community working toward a settlement on the Moon.
            </p>
          </header>

          <div className="mb-8 overflow-hidden rounded-[20px] border border-white/10 bg-dark-cool">
            <Image
              src="/assets/Moon-Launch.webp"
              alt="Earth and the Moon"
              width={800}
              height={450}
              className="h-40 w-full object-cover"
            />
          </div>

          <nav className="flex flex-col gap-3" aria-label="MoonDAO links">
            {visibleLinks.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                className="group flex items-center gap-4 rounded-[20px] border border-white/10 bg-dark-cool px-4 py-4 transition duration-150 hover:border-moon-gold"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-moon-gold/15 text-moon-gold">
                  <link.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-GoodTimes text-sm text-white sm:text-base">
                    {link.name}
                  </span>
                  <span className="mt-1 block font-RobotoMono text-[11px] leading-snug text-white/55">
                    {link.description}
                  </span>
                </span>
              </Link>
            ))}
          </nav>

          <p className="mt-10 text-center font-RobotoMono text-[11px] uppercase tracking-[0.18em] text-white/40">
            moondao.com
          </p>
        </div>
      </Container>
    </>
  )
}

export default LinkTree
