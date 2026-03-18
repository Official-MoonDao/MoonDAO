import { ChatBubbleLeftIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { TwitterIcon } from '../assets'

type SocialLinksProps = {
  socials: {
    communications?: string
    twitter?: string
    website?: string
    discord?: string
    socialLink?: string
    infoUri?: string
  }
  className?: string
  iconSize?: number
}

function getLinkLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    if (hostname.includes('discord')) return 'Discord'
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter'
    if (hostname.includes('telegram')) return 'Telegram'
    if (hostname.includes('github')) return 'GitHub'
    if (hostname.includes('medium')) return 'Medium'
    if (hostname.includes('youtube')) return 'YouTube'
    // Capitalize first letter of hostname
    return hostname.charAt(0).toUpperCase() + hostname.split('.')[0].slice(1)
  } catch {
    return 'Link'
  }
}

export default function MissionSocialLinks({
  socials,
  className = '',
  iconSize = 18,
}: SocialLinksProps) {
  const hasAnyLink =
    socials.communications ||
    socials.twitter ||
    socials.website ||
    socials.discord ||
    socials.socialLink ||
    socials.infoUri

  if (!hasAnyLink) return null

  const linkClass =
    'flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 text-sm'

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {socials.communications && (
        <Link
          className={linkClass}
          href={socials.communications}
          target="_blank"
          passHref
        >
          <ChatBubbleLeftIcon height={iconSize} width={iconSize} />
          <span>{getLinkLabel(socials.communications)}</span>
        </Link>
      )}
      {socials.twitter && (
        <Link
          className={linkClass}
          href={socials.twitter}
          target="_blank"
          passHref
        >
          <TwitterIcon />
          <span>Twitter</span>
        </Link>
      )}
      {socials.website && (
        <Link
          className={linkClass}
          href={socials.website}
          target="_blank"
          passHref
        >
          <GlobeAltIcon height={iconSize} width={iconSize} />
          <span>{getLinkLabel(socials.website)}</span>
        </Link>
      )}
      {socials.socialLink && (
        <Link
          className={linkClass}
          href={socials.socialLink}
          target="_blank"
          passHref
        >
          <ChatBubbleLeftIcon height={iconSize} width={iconSize} />
          <span>{getLinkLabel(socials.socialLink)}</span>
        </Link>
      )}
      {socials.infoUri && (
        <Link
          className={linkClass}
          href={socials.infoUri}
          target="_blank"
          passHref
        >
          <GlobeAltIcon height={iconSize} width={iconSize} />
          <span>{getLinkLabel(socials.infoUri)}</span>
        </Link>
      )}
    </div>
  )
}
