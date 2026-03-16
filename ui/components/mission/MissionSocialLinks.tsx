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

export default function MissionSocialLinks({
  socials,
  className = '',
  iconSize = 25,
}: SocialLinksProps) {
  const hasAnyLink =
    socials.communications ||
    socials.twitter ||
    socials.website ||
    socials.discord ||
    socials.socialLink ||
    socials.infoUri

  if (!hasAnyLink) return null

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {socials.communications && (
        <Link
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
          href={socials.communications}
          target="_blank"
          passHref
        >
          <ChatBubbleLeftIcon height={iconSize} width={iconSize} />
        </Link>
      )}
      {socials.twitter && (
        <Link
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
          href={socials.twitter}
          target="_blank"
          passHref
        >
          <TwitterIcon />
        </Link>
      )}
      {socials.website && (
        <Link
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
          href={socials.website}
          target="_blank"
          passHref
        >
          <GlobeAltIcon height={iconSize} width={iconSize} />
        </Link>
      )}
      {socials.socialLink && (
        <Link
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
          href={socials.socialLink}
          target="_blank"
          passHref
        >
          <ChatBubbleLeftIcon height={iconSize} width={iconSize} />
        </Link>
      )}
      {socials.infoUri && (
        <Link
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all duration-200"
          href={socials.infoUri}
          target="_blank"
          passHref
        >
          <GlobeAltIcon height={iconSize} width={iconSize} />
        </Link>
      )}
    </div>
  )
}
