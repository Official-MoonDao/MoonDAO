// Expanded Footer
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import {
  DiscordIcon,
  TwitterIcon,
  InstagramIcon,
  LinkedinIcon,
  GithubIcon,
  YoutubeIcon,
  CoinMarketCapIcon,
} from '@/components/assets'
import Disclaimer from './Disclaimer'
import LegalLinks from './LegalLinks'

type SocialLink = {
  href: string
  label: string
  icon: React.ReactNode
}

const socialLinks: SocialLink[] = [
  {
    href: 'https://x.com/OfficialMoonDAO',
    label: 'X (Twitter)',
    icon: <TwitterIcon />,
  },
  {
    href: 'https://discord.gg/moondao',
    label: 'Discord',
    icon: <DiscordIcon />,
  },
  {
    href: 'https://www.youtube.com/@officialmoondao',
    label: 'YouTube',
    icon: <YoutubeIcon />,
  },
  {
    href: 'https://www.instagram.com/official_moondao/',
    label: 'Instagram',
    icon: <InstagramIcon />,
  },
  {
    href: 'https://www.linkedin.com/company/moondao',
    label: 'LinkedIn',
    icon: <LinkedinIcon />,
  },
  {
    href: 'https://github.com/Official-MoonDao',
    label: 'GitHub',
    icon: <GithubIcon />,
  },
  {
    href: 'https://coinmarketcap.com/currencies/mooney/',
    label: 'CoinMarketCap',
    icon: <CoinMarketCapIcon />,
  },
]

type LinkItem = {
  text: string
  href: string
}

type LinkListProps = {
  title: string
  links: LinkItem[]
}

function LinkList({ title, links }: LinkListProps) {
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">{title}</h3>
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={index}>
            <Link
              href={link.href || '#'}
              className="text-white hover:text-purple-400 transition-colors"
            >
              {link.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type ExpandedFooterProps = {
  callToActionImage?: string
  callToActionBody?: string
  callToActionTitle?: string
  callToActionButtonText?: string
  callToActionButtonLink?: string
  hasCallToAction: boolean
  darkBackground?: boolean
  isFullwidth?: boolean
  disclaimerOnly?: boolean
}

export function ExpandedFooter({
  callToActionImage = '',
  callToActionBody,
  callToActionTitle = 'Join the Network',
  callToActionButtonText = 'Learn More',
  callToActionButtonLink = '/join',
  hasCallToAction = true,
  darkBackground = true,
  isFullwidth = true,
  disclaimerOnly = false,
}: ExpandedFooterProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const isCitizen = useCitizen(selectedChain)

  const [callToAction, setCallToAction] = useState({
    image: callToActionImage || '',
    body: callToActionBody,
    title: callToActionTitle,
    hasCallToAction: hasCallToAction,
    buttonText: callToActionButtonText,
    buttonLink: callToActionButtonLink || '/join',
  })

  useEffect(() => {
    setCallToAction({
      image: callToActionImage,
      body: callToActionBody,
      title: callToActionTitle,
      buttonText: callToActionButtonText,
      buttonLink: callToActionButtonLink,
      hasCallToAction: hasCallToAction,
    })
  }, [
    callToActionImage,
    callToActionBody,
    callToActionTitle,
    callToActionButtonText,
    callToActionButtonLink,
    hasCallToAction,
  ])

  // Footer navigation mirrors the top nav structure 1:1 (see
  // `ui/lib/navigation/useNavigation.tsx` and the Teams/Projects dropdown
  // components). Six groups in the same order as the header, with the same
  // child links — so users see a consistent IA in both places.
  const citizensLinks = [
    { text: 'Become a Citizen', href: '/citizen' },
    { text: 'Submit a Contribution', href: '/contributions' },
    { text: 'View Citizens', href: '/network?tab=citizens' },
    { text: 'Explore the Map', href: '/map' },
  ]

  const teamsLinks = [
    { text: 'Create a Team', href: '/join' },
    { text: 'Explore Teams', href: '/network?tab=teams' },
    { text: 'Jobs', href: '/jobs' },
    { text: 'Marketplace', href: '/marketplace' },
  ]

  const projectsLinks = [
    { text: 'Propose Project', href: '/proposals' },
    { text: 'Explore Projects', href: '/projects' },
    { text: 'Submit Contribution', href: '/contributions' },
    { text: 'Projects Overview', href: '/projects-overview' },
  ]

  const mooneyLinks = [
    { text: 'Get $MOONEY', href: '/get-mooney' },
    { text: 'Lock $MOONEY', href: '/lock' },
    { text: 'Bridge $MOONEY', href: '/bridge' },
    { text: 'Token Overview', href: '/mooney' },
    { text: 'Governance Overview', href: '/governance' },
    { text: 'Governance Proposals', href: '/governance-proposals' },
  ]

  const launchpadLinks = [
    { text: 'Launchpad Explainer', href: '/launch' },
    { text: 'Overview Fundraiser', href: '/mission/4' },
    { text: 'Fly with Frank Leaderboard', href: '/overview-vote' },
  ]

  const learnLinks = [
    { text: 'News', href: '/news' },
    { text: 'Town Hall', href: '/townhall' },
    { text: 'Roadmap', href: '/roadmap' },
    { text: 'About', href: '/about' },
    { text: 'Resources', href: '/resources' },
    { text: 'Constitution', href: '/constitution' },
  ]

  return (
    <>
      {!disclaimerOnly && (
        <div
          id="expanded-menu"
          className={`overflow-hidden relative ${
            isFullwidth ? 'bg-dark-cool' : ''
          } px-6 text-white`}
        >
          <div
            id="expanded-menu-container"
            className={`${
              isFullwidth
                ? 'container mx-auto md:pl-[5vw] lg:pl-[2vw] md:pb-0 md:pt-[5vh]'
                : 'pb-[5vw] md:pt-[5vw]'
            } max-w-[1200px] pb-0 flex flex-col lg:grid lg:grid-cols-6 gap-8 relative z-10`}
          >
            {hasCallToAction && isFullwidth && (
              <div className="flex flex-col pb-[5vh] p-[2vw]  md:p-0 py-0 lg:col-span-2 order-2 lg:order-1 relative min-h-[250px] lg:min-h-[300px]">
                <div className="overflow-visible absolute bottom-0 left-0 z-0 w-full flex items-end">
                  <Image
                    className="overflow-visible object-contain object-left ml-[-10vw] md:ml-0 w-full "
                    src={callToAction.image}
                    alt="Join the Space Acceleration Network"
                    width={2000}
                    height={2000}
                  />
                </div>
                <h2 className="z-50 text-2xl font-bold font-GoodTimes mb-3">
                  {callToAction.title}
                </h2>
                {callToAction.body && (
                  <p className="max-w-[400px] mb-4 opacity-80">{callToAction.body}</p>
                )}
                <div>
                  <Link
                    href={callToAction.buttonLink}
                    className="gradient-2 hover:pl-7 transform transition-all ease-in-out duration-300 rounded-[2vmax] rounded-tl-[10px] mt-2 px-5 py-3 inline-block"
                  >
                    {callToAction.buttonText}
                  </Link>
                </div>
              </div>
            )}

            <div
              className={`z-50 px-[2vw] pt-[2vh] md:pt-0 py-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 order-1 lg:order-2 ${
                hasCallToAction && isFullwidth ? 'lg:col-span-4' : 'lg:col-span-6'
              }`}
            >
              {/* Columns mirror the top-nav groups in order:
                  Citizens → Teams → Projects → $MOONEY → Launchpad → Learn */}
              <div>
                <LinkList title="CITIZENS" links={citizensLinks} />
              </div>
              <div>
                <LinkList title="TEAMS" links={teamsLinks} />
              </div>
              <div>
                <LinkList title="PROJECTS" links={projectsLinks} />
              </div>
              <div>
                <LinkList title="$MOONEY" links={mooneyLinks} />
              </div>
              <div>
                <LinkList title="LAUNCHPAD" links={launchpadLinks} />
              </div>
              <div>
                <LinkList title="LEARN" links={learnLinks} />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="container mx-auto px-[5vw] xl:px-[2vw] max-w-[1200px] w-full">
            <div className="flex flex-col items-center border-t border-white/10 mt-6 pt-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase mb-4">
                Follow Us
              </h3>
              {/*
                7 social icons at 40px + a 16px gap was overflowing on
                ~360–390px viewports (the row needs ~376px but the
                container's `px-[5vw]` padding only leaves ~325px), which
                clipped the rightmost icons (GitHub / CoinMarketCap).
                `flex-wrap` lets the row break onto a second line on
                phones, and the slightly smaller icon + gap on mobile keeps
                it to a single tidy row when there's room.
              */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-6 max-w-full">
                {socialLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300 opacity-70 hover:opacity-100"
                    aria-label={link.label}
                  >
                    {link.icon}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-400 mb-4">
                <Link
                  href="https://docs.moondao.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Documentation
                </Link>
                <span className="text-gray-600">•</span>
                <Link
                  href="https://news.moondao.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Newsletter
                </Link>
                <span className="text-gray-600">•</span>
                <Link
                  href="https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395&chain=mainnet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Trade $MOONEY
                </Link>
                <span className="text-gray-600">•</span>
                {/* Support used to be its own footer column, but the top-nav
                    has no Support group. Surface it here as a utility link
                    so users still have a one-click path to help. */}
                <Link
                  href="https://discord.gg/moondao"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Submit a Ticket
                </Link>
              </div>
            </div>
          </div>

          {/* Footer content moved into main section */}
          <div className="container mx-auto px-[5vw] xl:px-[2vw] flex flex-col items-center pt-4 pb-10 max-w-[1200px] w-full">
            <div className="pb-5">
              <Disclaimer isCentered={false} />
            </div>

            <div>
              <LegalLinks isCentered={true} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
