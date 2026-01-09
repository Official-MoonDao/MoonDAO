//ProfileCard
import Image from 'next/image'
import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import {
  generatePrettyLink,
  generatePrettyLinkWithId,
} from '@/lib/subscription/pretty-links'
import Frame from '../layout/Frame'
import StandardButton from '../layout/StandardButton'
import AdaptiveImage from './AdaptiveImage'

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
  entitytype?: string
  orgid?: string
  metadata?: any
  owner?: string
  type?: string
  horizontalscroll?: boolean
  role?: string
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
  entitytype,
  orgid,
  metadata,
  owner,
  type,
  role,
  horizontalscroll = false,
  profile = false,
}: CardProps) {
  icon =
    type === 'team'
      ? '/assets/icon-org.svg'
      : icon ?? '/assets/icon-passport.svg'
  iconAlt = iconAlt ?? 'Star'

  const [citizenDiscord, setCitizenDiscord] = useState<string | undefined>()

  useEffect(() => {
    if (type === 'citizen' && metadata) {
      const discordAttribute = metadata.attributes?.find(
        (attr: any) => attr.trait_type === 'discord'
      )
      setCitizenDiscord(discordAttribute?.value)
    }
  }, [type, metadata])

  const cardContent = (
    <span
      id="card-container"
      className="animate-fadeIn flex flex-col relative bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full h-full min-h-[200px]"
    >
      <span
        id="content-container"
        className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between"
      >
        <span
          id="content"
          className="animate-fadeIn relative z-50 flex flex-col"
        >
          {orgimage && (
            <div id="featured-image-container" className="z-50 animate-fadeIn">
              <Frame noPadding marginBottom="0px">
                <Image
                  id="featured-image"
                  src={orgimage}
                  alt="Entity Image"
                  width="675"
                  height="675"
                  className="w-full h-full"
                />
              </Frame>
            </div>
          )}
          {metadata?.image && (
            <div id="entity-citizen-image-container" className="z-40">
              <Frame noPadding marginBottom="0px" className="">
                {metadata?.image && (
                  <div id="entity-citizen-image-container" className="z-40">
                    <Frame noPadding marginBottom="0px" className="">
                      <AdaptiveImage
                        alt="Entity Image"
                        className=""
                        src={metadata.image}
                        height={675}
                        width={675}
                      />
                    </Frame>
                  </div>
                )}
              </Frame>
            </div>
          )}
          <span
            id="title-section"
            className={`
                            flex 
                            ${
                              inline
                                ? 'pb-5 flex-row items-center pr-5 justify-start'
                                : 'flex-col justify-center items-center'
                            }
                        `}
          >
            <Image
              id="featured-icon"
              src={icon}
              alt={iconAlt}
              width="250"
              height="250"
              className={`z-20 ${
                inline
                  ? 'pt-[20px] w-[50px] h-[50px]'
                  : 'w-[100px] h-[100px] pb-5'
              }`}
            />
            <h2
              id="main-header"
              className={`
                                z-20 pt-[20px] static-sub-header font-GoodTimes flex items-center 
                                ${
                                  inline
                                    ? 'text-left'
                                    : 'text-left md:justify-start'
                                }
                            `}
            >
              {header && header}
              {metadata?.name ? metadata.name : profile && 'Anon'}
            </h2>
          </span>
          {subheader && subheader}
          <div id="description-and-id-container" className="relative z-50">
            <div
              id="description-and-id"
              className={metadata?.name && 'description'}
            >
              <div className="flex opacity-[70%] text-left items-start">
                {paragraph}
              </div>
              {metadata?.id ? (
                <div id="details-container" className="mt-4 font-RobotoMono">
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
                  <div id="details-container" className="mt-4 font-RobotoMono">
                    <p id="org-description">
                      This citizen has yet to add a profile
                    </p>
                    <div id="handle-container">Discord: NONE</div>
                  </div>
                )
              )}
              {hovertext && metadata?.name && (
                <span
                  id="mobile-button-container"
                  className="md:hidden flex pt-5 pb-5 justify-start w-full"
                >
                  <StandardButton
                    textColor="text-white"
                    borderRadius="rounded-tl-[10px] rounded-[2vmax]"
                    link="#"
                    paddingOnHover="pl-5"
                    className="gradient-2"
                    styleOnly={true}
                  >
                    {hovertext}
                  </StandardButton>
                </span>
              )}
            </div>
            {hovertext && (
              <span
                id="hovertext-container"
                className="hovertext absolute left-0 bottom-[-250px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+300px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
              >
                <span id="hovertext" className="hidden md:block">
                  {hovertext}
                </span>
              </span>
            )}
          </div>
        </span>
      </span>
    </span>
  )

  if (!metadata) {
    return (
      <div className="min-w-[300px] min-h-[400px] bg-dark-cool rounded-[20px] animate-pulse" />
    )
  }

  return (
    <span
      id="link-frame"
      className={`
                card-container min-w-[300px] w-full max-w-[450px] md:max-w-[450px] md:w-full flex items-center lg:flex-col rounded-[20px] relative overflow-hidden 
                ${link ? 'cursor-pointer' : ''}
            `}
    >
      {link ? (
        <Link
          id="card-link"
          prefetch={true}
          href={link}
          className="w-full h-full block"
        >
          {cardContent}
        </Link>
      ) : metadata?.name ? (
        <Link
          prefetch={true}
          href={
            metadata.name
              ? `/${type === 'team' ? 'team' : 'citizen'}/${
                  type === 'team'
                    ? generatePrettyLink(metadata.name)
                    : generatePrettyLinkWithId(metadata.name, metadata.id)
                }`
              : ''
          }
          passHref
        >
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
    </span>
  )
}
