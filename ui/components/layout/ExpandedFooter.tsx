// Expanded Footer
import Image from 'next/image'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { useCitizen } from '@/lib/citizen/useCitizen'
import { NAV_GROUPS } from '@/lib/navigation/nav-config'
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
import ReportBugButton from './ReportBugButton'

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
    href: 'https://moondao.com/discord',
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
  /** Makes the column heading itself the group's landing page. */
  titleHref?: string
}

function LinkList({ title, links, titleHref }: LinkListProps) {
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">
        {titleHref ? (
          <Link href={titleHref} className="hover:text-purple-400 transition-colors">
            {title}
          </Link>
        ) : (
          title
        )}
      </h3>
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
                : 'mx-auto pb-[5vw] md:pt-[5vw]'
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

            {/* One column per top-nav group, in the same order, built from the
                same `NAV_GROUPS` the bar reads. These columns used to be six
                hand-written arrays kept in sync by hand, and they had drifted:
                "Create a Team" pointed somewhere else than it did in the bar,
                and Moon Base Zero and DePrize had no columns at all.

                The footer is also where the long tail lives. Each group's
                `footerOnly` entries — templates, archives, reference pages —
                are appended here and nowhere else, which is what lets the bar
                stay short without those pages becoming unreachable. */}
            <div
              className={`z-50 px-[2vw] pt-[2vh] md:pt-0 py-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 order-1 lg:order-2 ${
                hasCallToAction && isFullwidth ? 'lg:col-span-4' : 'lg:col-span-6'
              }`}
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.name}>
                  <LinkList
                    title={group.name.toUpperCase()}
                    titleHref={group.href}
                    links={[...group.children, ...(group.footerOnly ?? [])].map(
                      (link) => ({ text: link.name, href: link.href })
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Social Links */}
          <div className="container mx-auto px-[5vw] xl:px-[2vw] max-w-[1200px] w-full">
            <div className="flex flex-col items-center border-t border-white/10 mt-6 pt-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase mb-4">Follow Us</h3>
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
              <div className="mb-6">
                <ReportBugButton />
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-gray-400 mb-4">
                <Link href="/docs" className="hover:text-white transition-colors">
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
                  href="https://moondao.com/discord"
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
