import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { LogoSidebar } from '../components/assets'
import Container from '../components/layout/Container'
import WebsiteHead from '../components/layout/Head'

type HubLink = {
  name: string
  description: string
  url: string
  icon?: string
  /** HOLD entries stay in source but are not rendered. */
  hidden?: boolean
}

const HUB_LINKS: HubLink[] = [
  {
    name: 'Become a Citizen',
    description: 'Join the Space Acceleration Network',
    url: 'https://moondao.com/join?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-join',
    icon: '/assets/linktree/icon-citizen-96.png',
  },
  {
    name: 'Send Frank to Space',
    description: 'The mission to fly with Frank White',
    url: 'https://moondao.com/frank?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-frank',
    icon: '/assets/linktree/icon-frank-96.png',
  },
  {
    name: 'Events and Town Hall',
    description: 'Gatherings for the MoonDAO community',
    url: 'https://moondao.com/events?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-events',
    icon: '/assets/linktree/icon-events-96.png',
  },
  {
    name: 'Join our Discord',
    description: 'Talk with the MoonDAO community',
    url: 'https://moondao.com/discord?utm_source=instagram&utm_medium=bio&utm_campaign=ig-bio-discord',
    icon: '/assets/linktree/icon-discord-96.png',
  },
  // HOLD: not primary buttons on the Instagram hub.
  {
    name: 'Website',
    description: 'MoonDAO home',
    url: 'https://moondao.com',
    hidden: true,
  },
  {
    name: 'Newsletter',
    description: 'Weekly updates',
    url: 'https://moondao.ck.page/profile',
    hidden: true,
  },
  {
    name: 'Twitter/X',
    description: 'Daily updates and space news',
    url: '/twitter',
    hidden: true,
  },
  {
    name: 'YouTube',
    description: 'Space missions and educational content',
    url: 'https://youtube.com/@officialmoondao',
    hidden: true,
  },
]

const LinkTree: React.FC = () => {
  const visibleLinks = HUB_LINKS.filter((link) => !link.hidden && link.icon)

  return (
    <>
      <WebsiteHead
        title="MoonDAO"
        description="Become a Citizen, follow the mission to send Frank White to space, and find MoonDAO events and Discord."
      />
      <Container>
        <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-16 pt-8 sm:pt-12">
          <header className="mb-6 text-center">
            <h1 className="sr-only">MoonDAO</h1>
            <div className="mx-auto w-56 text-white sm:w-64">
              <LogoSidebar />
            </div>
            <p className="mt-4 font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-moon-gold">
              Space Acceleration Network
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-300">
              A community working toward a settlement on the Moon.
            </p>
          </header>

          <div className="mb-6 overflow-hidden rounded-[20px] border border-white/10">
            <Image
              src="/assets/linktree/hero-1200x600.webp"
              alt="Earth and the Moon"
              width={1200}
              height={600}
              priority
              className="h-auto w-full"
            />
          </div>

          <nav className="flex flex-col gap-3" aria-label="MoonDAO links">
            {visibleLinks.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                className="group flex items-center gap-4 rounded-[20px] border border-white/10 bg-dark-cool px-4 py-3.5 transition duration-150 hover:border-moon-gold"
              >
                <Image
                  src={link.icon as string}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0"
                />
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
