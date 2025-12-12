import { ReactNode, useEffect, useState } from 'react'
import StandardCard from './StandardCard'

interface CardProps {
  icon?: string
  iconAlt?: string
  header?: string
  paragraph?: ReactNode
  link?: string
  hovertext?: string
  inline?: boolean
  orgimage?: string
  subheader?: any
  metadata?: any
  type?: string
  profile?: boolean
  children?: ReactNode
  variant?: string
  maxWidthClassNames?: string
  className?: string
  layout?: string
}

export default function Card({
  icon,
  header,
  paragraph,
  link,
  hovertext,
  inline,
  iconAlt,
  orgimage,
  subheader,
  metadata,
  type,
  profile = false,
  children,
  variant,
  maxWidthClassNames,
  className = '',
  layout,
}: CardProps) {
  const [citizenDiscord, setCitizenDiscord] = useState<string | undefined>()

  useEffect(() => {
    if (type === 'citizen' && metadata) {
      const discordAttribute = metadata.attributes?.find(
        (attr: any) => attr.trait_type === 'discord'
      )
      setCitizenDiscord(discordAttribute?.value)
    }
  }, [type, metadata])

  // If variant and maxWidthClassNames are provided, render as a simple card container with children
  if (variant || maxWidthClassNames !== undefined) {
    const baseClasses =
      'bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40'
    const widthClasses = maxWidthClassNames || 'max-w-md md:max-w-xl'
    const layoutClasses = layout === 'wide' ? 'w-full' : ''

    return (
      <div className={`${baseClasses} ${widthClasses} ${layoutClasses} ${className}`}>
        {children}
      </div>
    )
  }

  // Prepare enhanced paragraph content with additional details
  const enhancedParagraph = (
    <>
      {paragraph}
      {metadata?.id !== undefined ? (
        <div id="details-container" className="font-RobotoMono">
          <p id="org-description">
            {metadata.description && metadata.description.length > 100
              ? `${metadata.description.slice(0, 100)}...`
              : metadata.description}
          </p>
          {type === 'citizen' && citizenDiscord && (
            <div id="handle-container">Discord: @{citizenDiscord}</div>
          )}
        </div>
      ) : (
        profile && (
          <div id="details-container" className="font-RobotoMono">
            <p id="org-description">This citizen has yet to add a profile.</p>
            <div id="handle-container">Discord: NONE</div>
          </div>
        )
      )}
    </>
  )

  return (
    <StandardCard
      id="card-container"
      icon={type === 'team' ? '/assets/icon-org.svg' : icon}
      paragraph={enhancedParagraph}
      link={link}
      hovertext={hovertext}
      inline={inline}
      iconAlt={iconAlt}
      orgimage={orgimage}
      subheader={subheader}
      image={metadata?.image}
      title={metadata?.name}
      type={type}
      profile={profile}
    />
  )
}
