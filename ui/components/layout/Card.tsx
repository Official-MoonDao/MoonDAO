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
      profile={profile} // Add any footer content if needed
    />
  )
}
