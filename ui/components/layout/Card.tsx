import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { ReactNode, useState } from 'react'
import { cardStyles, spacing, commonCombinations } from '@/lib/layout/styles'
import { CardVariant, CardSize, CardLayout, cardSizes } from '@/lib/layout/variants'
import CollapsibleContainer from './CollapsibleContainer'
import Frame from './Frame'
import SmartImage from './SmartImage'
import StandardButton from './StandardButton'

export interface CardProps {
  id?: string
  variant?: CardVariant
  layout?: CardLayout
  size?: CardSize
  className?: string
  children?: ReactNode
  header?: string
  title?: string
  icon?: string | ReactNode
  iconAlt?: string
  iconSrc?: string
  paragraph?: ReactNode
  fullParagraph?: boolean
  link?: string
  onClick?: () => void
  hovertext?: string
  inline?: boolean
  orgimage?: string
  subheader?: ReactNode
  image?: string
  secondaryImage?: string
  actions?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  padding?: 'sm' | 'md' | 'lg' | 'none'
  clickable?: boolean
  profile?: boolean
  type?: string
  height?: string
  headerLink?: string
  headerLinkLabel?: string
  badges?: string[]
  stats?: {
    value: string | number
    subtitle?: string
    trend?: {
      value: string
      isPositive: boolean
    }
  }
  showMore?: boolean
  showMoreButton?: boolean
  loading?: boolean
  maxWidthClassNames?: string
  gradientBg?: boolean
  gradientFrom?: string
  gradientTo?: string
  compact?: boolean
}

function renderCardImage({
  image,
  orgimage,
  title,
  profile,
  className = 'w-full h-full object-cover',
  width = 200,
  height = 200,
}: {
  image?: string
  orgimage?: string
  title?: string
  profile?: boolean
  className?: string
  width?: number
  height?: number
}) {
  if (image) {
    return (
      <SmartImage
        src={image}
        alt={title || (profile ? 'Anon' : '')}
        width={width}
        height={height}
        className={className}
      />
    )
  }
  if (orgimage) {
    return (
      <Image
        src={orgimage}
        alt={title || (profile ? 'Anon' : '')}
        width={width}
        height={height}
        className={className}
      />
    )
  }
  return null
}

function renderShowMoreButton({
  isExpanded,
  setIsExpanded,
  fullParagraph,
  showMoreButton,
}: {
  isExpanded: boolean
  setIsExpanded: (value: boolean) => void
  fullParagraph: boolean
  showMoreButton: boolean
}) {
  if (!fullParagraph || !showMoreButton) return null

  return (
    <div className="absolute bottom-[-20px] left-[5%] gradient-2 rounded-full z-[50]">
      <StandardButton
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        styleOnly={true}
      >
        {isExpanded ? 'Show Less' : 'Show More'}
      </StandardButton>
    </div>
  )
}

function renderWideCardContent({
  image,
  orgimage,
  secondaryImage,
  title,
  header,
  profile,
  subheader,
  actions,
  paragraph,
  fullParagraph,
  isExpanded,
  footer,
  showMoreButton,
  setIsExpanded,
}: {
  image?: string
  orgimage?: string
  secondaryImage?: string
  title?: string
  header?: string
  profile?: boolean
  subheader?: ReactNode
  actions?: ReactNode
  paragraph?: ReactNode
  fullParagraph: boolean
  isExpanded: boolean
  footer?: ReactNode
  showMoreButton: boolean
  setIsExpanded: (value: boolean) => void
}) {
  return (
    <>
      <span id="content" className={`animate-fadeIn relative z-50 flex flex-col gap-6`}>
        <div className="relative flex flex-col lg:flex-row gap-4 items-center">
          {(image || orgimage) && (
            <div className="relative w-full h-full md:w-[275px] md:h-[275px] md:mx-8">
              <div className="relative w-full h-full md:w-[275px] md:h-[275px] md:rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                {renderCardImage({
                  image,
                  orgimage,
                  title,
                  profile,
                  className: 'w-full h-full object-cover',
                  width: 200,
                  height: 200,
                })}
              </div>
              {secondaryImage && (
                <Image
                  src={secondaryImage}
                  alt={title || ''}
                  width={250}
                  height={250}
                  className="absolute -bottom-12 left-0 md:-bottom-20 md:left-24 rounded-full scale-75 md:scale-50 z-[100]"
                />
              )}
            </div>
          )}

          <div className="p-[32px] md:p-0 w-full flex flex-col text-left">
            <div className="flex flex-col gap-2">
              <h2 className="font-GoodTimes text-2xl text-white">
                {header || title || (profile && 'Anon')}
              </h2>
              {subheader && <div className="text-gray-400 text-lg">{subheader}</div>}
            </div>
            {actions && <div className="mt-4 flex flex-row gap-4">{actions}</div>}
          </div>
        </div>

        <div className={`text-gray-300 overflow-hidden ${isExpanded ? 'h-full' : 'max-h-[100px]'}`}>
          {fullParagraph || typeof paragraph !== 'string' ? paragraph : paragraph?.slice(0, 100)}
        </div>

        {footer && <div className="mt-4">{footer}</div>}
      </span>
      {renderShowMoreButton({
        isExpanded,
        setIsExpanded,
        fullParagraph,
        showMoreButton,
      })}
    </>
  )
}

function renderWideCardWrapper({
  link,
  onClick,
  children,
}: {
  link?: string
  onClick?: () => void
  children: ReactNode
}) {
  const cardContent = (
    <div>
      <span
        id="card-container"
        className={`relative animate-fadeIn flex flex-col relative bg-dark-cool rounded-[20px] w-full h-full`}
      >
        <div className="flex-grow">
          <div
            id="card-styling"
            className="bg-dark-cool rounded-[20px] w-full h-full absolute top-0 left-0"
          ></div>
          <span
            id="content-container"
            className={`h-full md:p-[32px] rounded-[20px] overflow-hidden flex flex-col justify-between bg-slate-800/50`}
          >
            {children}
          </span>
        </div>
      </span>
    </div>
  )

  if (onClick) {
    return (
      <div onClick={onClick} className="w-full h-full block">
        {cardContent}
      </div>
    )
  }

  if (link) {
    return (
      <Link id="card-link" href={link} className="w-full h-full block">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

export default function Card({
  id,
  variant = 'gradient',
  layout,
  size = 'md',
  className = '',
  children,
  header,
  title,
  icon,
  iconAlt,
  iconSrc,
  paragraph,
  fullParagraph = false,
  link,
  onClick,
  hovertext,
  inline = false,
  orgimage,
  subheader,
  image,
  secondaryImage,
  actions,
  action,
  footer,
  padding = 'md',
  clickable,
  profile = false,
  type,
  height,
  headerLink,
  headerLinkLabel,
  badges,
  stats,
  showMore = false,
  showMoreButton = true,
  loading,
  maxWidthClassNames,
  gradientBg,
  gradientFrom,
  gradientTo,
  compact = false,
}: CardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = React.useState(showMore)

  const paddingClass =
    padding === 'sm'
      ? spacing.cardPaddingSmall
      : padding === 'lg'
      ? spacing.cardPaddingLarge
      : padding === 'none'
      ? ''
      : spacing.cardPadding

  const variantClass = cardStyles[variant] || cardStyles.gradient
  const sizeClass = cardSizes[size] || ''

  const isClickable = clickable !== undefined ? clickable : !!(link || onClick)

  if (loading) {
    return (
      <button className="btn btn-square btn-ghost btn-disabled bg-transparent loading"></button>
    )
  }

  if (layout === 'stats' && stats) {
    return (
      <div id={id} className={`${cardStyles.slateBorder} ${paddingClass} ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-400 mb-2">{header || title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-bold text-white">{stats.value}</h3>
              {stats.trend && (
                <span
                  className={`text-sm font-semibold ${
                    stats.trend.isPositive ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stats.trend.isPositive ? '↑' : '↓'} {stats.trend.value}
                </span>
              )}
            </div>
            {stats.subtitle && <p className="text-xs text-slate-500 mt-1">{stats.subtitle}</p>}
          </div>
          {icon && <div className="flex-shrink-0 ml-4 p-3 bg-slate-600/30 rounded-xl">{icon}</div>}
        </div>
        {children}
      </div>
    )
  }

  if (layout === 'launchpad' || layout === 'feature') {
    const gradientClasses =
      gradientFrom && gradientTo
        ? `bg-gradient-to-br ${gradientFrom} ${gradientTo}`
        : cardStyles.gradient
    const borderClass =
      layout === 'launchpad'
        ? 'border border-white/20 hover:border-white/40'
        : 'border border-white/10'

    return (
      <div
        id={id}
        className={`${gradientClasses} ${
          layout === 'launchpad' ? 'backdrop-blur-sm rounded-3xl' : 'rounded-xl'
        } ${paddingClass} ${borderClass} transition-all duration-300 group h-full ${className}`}
      >
        <div
          className={`flex flex-col items-center text-center ${
            layout === 'launchpad' ? 'space-y-4 md:space-y-6 h-full' : 'space-y-3 md:space-y-4'
          }`}
        >
          {icon && (
            <div
              className={`${
                gradientFrom && gradientTo
                  ? `bg-gradient-to-br ${gradientFrom
                      .replace('/40', '')
                      .replace('/20', '')} ${gradientTo.replace('/60', '').replace('/20', '')}`
                  : 'bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20'
              } ${layout === 'launchpad' ? 'rounded-full' : 'rounded-xl md:rounded-2xl'} ${
                layout === 'launchpad' ? 'p-3 md:p-4' : 'p-2 md:p-3 lg:p-4'
              } group-hover:scale-110 transition-transform duration-300`}
            >
              {typeof icon === 'string' ? (
                <Image
                  src={icon}
                  alt={title || ''}
                  width={48}
                  height={48}
                  className={
                    layout === 'launchpad'
                      ? 'w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16'
                      : 'w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12'
                  }
                />
              ) : (
                icon
              )}
            </div>
          )}
          <div className={layout === 'launchpad' ? 'flex-1' : ''}>
            {stats && layout === 'launchpad' ? (
              <>
                <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
                  {stats.value}
                  <br />
                  {header || title}
                </h3>
                {paragraph && (
                  <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
                    {paragraph}
                  </p>
                )}
              </>
            ) : (
              <>
                <h3
                  className={`${
                    layout === 'launchpad'
                      ? 'text-lg md:text-xl lg:text-2xl xl:text-3xl'
                      : 'text-lg font-bold'
                  } font-GoodTimes text-white ${layout === 'launchpad' ? 'mb-2 md:mb-4' : 'mb-2'}`}
                >
                  {header || title}
                </h3>
                {paragraph && (
                  <p
                    className={`${
                      layout === 'launchpad'
                        ? 'text-white/80 text-xs md:text-sm lg:text-base'
                        : 'text-gray-300 text-sm'
                    } ${layout === 'launchpad' ? 'leading-relaxed' : 'mb-3'}`}
                  >
                    {paragraph}
                  </p>
                )}
                {badges && badges.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {badges.map((badge, index) => (
                      <span
                        key={index}
                        className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {children}
      </div>
    )
  }

  if (maxWidthClassNames || gradientBg) {
    const maxWidth = maxWidthClassNames || 'max-w-md md:max-w-xl'
    return (
      <div className={maxWidth} data-cy="main-card">
        <div
          className={`card min-w-80 md:w-full rounded-[15px] border-[0.5px] border-gray-300 bg-black bg-opacity-30 shadow-indigo-40 text-white font-RobotoMono shadow-md overflow-visible ${
            gradientBg && 'bg-gradient-to-r from-n3blue to-n3green'
          }`}
        >
          <div className={`card-body items-stretch items-center ${className}`}>
            {title && (
              <h2
                className={`card-title text-center text-3xl font-medium mb-2 ${
                  gradientBg && 'text-white'
                }`}
              >
                {title}
              </h2>
            )}
            {children}
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'wide') {
    const wideCardContent = renderWideCardContent({
      image,
      orgimage,
      secondaryImage,
      title,
      header,
      profile,
      subheader,
      actions,
      paragraph,
      fullParagraph,
      isExpanded,
      footer,
      showMoreButton,
      setIsExpanded,
    })

    return (
      <span
        id="link-frame"
        className={`
          card-container w-full flex lg:flex-col rounded-[20px] relative p-2 ${
            link || onClick ? 'hover-gradient-2 cursor-pointer' : ''
          }
        `}
      >
        {renderWideCardWrapper({
          link,
          onClick,
          children: wideCardContent,
        })}
      </span>
    )
  }

  const iconElement = iconSrc ? (
    <Image src={iconSrc} alt="Section icon" width={30} height={30} />
  ) : typeof icon === 'string' ? (
    <Image
      src={icon}
      alt={iconAlt || ''}
      width={inline ? 50 : 100}
      height={inline ? 50 : 100}
      className={`z-20 ${inline ? 'pt-[20px] w-[50px] h-[50px]' : 'w-[100px] h-[100px] pb-5'}`}
    />
  ) : icon ? (
    <div className={inline ? 'pt-[20px] w-[50px] h-[50px]' : 'w-[100px] h-[100px] pb-5'}>
      {icon}
    </div>
  ) : null

  const cardContent =
    variant === 'gradient' ? (
      <span
        id={id}
        className={`animate-fadeIn flex flex-col relative ${variantClass} ${sizeClass} w-full h-full ${className}`}
      >
        <div className="flex-grow">
          <span
            id="content-container"
            className={`h-full ${
              padding === 'sm' ? 'p-[16px]' : padding === 'lg' ? 'p-[32px]' : 'p-[20px]'
            } md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between`}
          >
            <span id="content" className={`animate-fadeIn relative z-50 flex flex-col`}>
              {orgimage && (
                <div id="featured-image-container" className="z-50 animate-fadeIn">
                  <Frame noPadding marginBottom="0px">
                    <Image
                      id="featured-image"
                      src={orgimage}
                      alt={title || ''}
                      width="675"
                      height="675"
                      className="w-full h-full"
                    />
                  </Frame>
                </div>
              )}

              {image && (
                <div id="team-citizen-image-container" className="z-40">
                  <Frame noPadding marginBottom="0px" className="aspect-square">
                    <SmartImage
                      src={image}
                      alt={title || ''}
                      width={500}
                      height={500}
                      className="w-full h-full object-cover"
                    />
                  </Frame>
                </div>
              )}

              <div className="mt-4 flex flex-row justify-between items-start">
                {headerLink && headerLinkLabel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(headerLink)
                    }}
                    className="w-fit text-light-cool hover:text-light-warm font-GoodTimes text-sm text-left relative z-[60]"
                  >
                    {headerLinkLabel}
                  </button>
                )}
                <div className="flex flex-row justify-between">
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
                    {iconElement && iconElement}
                  </span>
                </div>
              </div>
              <div className="mt-4 w-full flex">
                <h2
                  id="main-header"
                  className={`
                    w-full z-20 static-sub-header font-GoodTimes flex min-h-[50px]
                    ${inline ? 'text-left' : 'text-center justify-center md:justify-start'}
                `}
                >
                  {header && header}
                  {title ? title : profile && 'Anon'}
                </h2>
                <div className="pl-2">{actions && actions}</div>
              </div>

              {subheader && subheader}
              <div id="description-and-id-container" className="relative z-50">
                <div id="description-and-id" className={`text-left ${hovertext && 'description'}`}>
                  {paragraph &&
                    (fullParagraph ? (
                      <CollapsibleContainer minHeight="100px">{paragraph}</CollapsibleContainer>
                    ) : (
                      <div
                        className={`flex opacity-[70%] ${
                          paragraph ? 'min-h-[100px]' : 'min-h-[20px]'
                        }`}
                      >
                        <div className="flex opacity-[70%] min-h-[100px] break-words">
                          {paragraph &&
                          !fullParagraph &&
                          typeof paragraph === 'string' &&
                          paragraph.length > 100
                            ? `${paragraph.slice(0, 100)}...`
                            : paragraph}
                        </div>
                      </div>
                    ))}
                  {footer && footer}
                  {hovertext && (
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
                    className="hovertext absolute left-0 bottom-[-320px] ml-[-20px] w-[calc(100%+40px)] h-[calc(100%+325px)] p-[20px] text-lg rounded-[10px] text-white md:text-darkest-cool hovertext-bg flex justify-center z-50"
                  >
                    <span id="hovertext" className="hidden md:block">
                      {hovertext}
                    </span>
                  </span>
                )}
              </div>
              {children && <div className="mt-4">{children}</div>}
            </span>
          </span>
        </div>
      </span>
    ) : (
      <div
        id={id}
        className={`${variantClass} ${sizeClass} ${paddingClass} ${className} ${
          height ? `h-[${height}]` : ''
        } ${isClickable ? 'cursor-pointer' : ''} ${
          variant === 'slate' || variant === 'slateBorder'
            ? 'transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl'
            : ''
        }`}
      >
        {(header || title || iconElement || iconSrc || actions || action) && (
          <div
            className={`flex ${
              variant === 'slate' || variant === 'slateBorder'
                ? 'justify-between'
                : 'flex-col lg:flex-row'
            } items-start lg:items-center ${
              variant === 'slate' || variant === 'slateBorder' ? 'mb-6' : 'mb-4'
            } gap-4`}
          >
            <div
              className={`flex ${inline ? 'flex-row items-center' : 'flex-col'} ${
                variant === 'slate' || variant === 'slateBorder' ? 'gap-5' : 'gap-4'
              } items-center`}
            >
              {iconElement && (
                <div
                  className={variant === 'slate' || variant === 'slateBorder' ? 'opacity-70' : ''}
                >
                  {iconElement}
                </div>
              )}
              {iconSrc && <div className="opacity-70">{iconElement}</div>}
              {(header || title) && (
                <h2
                  className={`font-GoodTimes text-white ${
                    variant === 'slate' || variant === 'slateBorder'
                      ? 'text-2xl lg:text-3xl'
                      : 'text-lg'
                  } ${inline ? 'text-left' : 'text-center md:text-left'}`}
                >
                  {header || title || (profile && 'Anon')}
                </h2>
              )}
            </div>
            {(actions || action) && <div className="flex gap-3">{actions || action}</div>}
          </div>
        )}

        {image && (
          <div className="z-40 mb-4">
            <Frame noPadding marginBottom="0px" className="aspect-square">
              <SmartImage
                src={image}
                alt={title || ''}
                width={500}
                height={500}
                className="w-full h-full object-cover"
              />
            </Frame>
          </div>
        )}

        {subheader && <div className="mb-4">{subheader}</div>}

        {paragraph && (
          <div className={`text-left ${hovertext ? 'description' : ''}`}>
            {fullParagraph ? (
              <CollapsibleContainer minHeight="100px">{paragraph}</CollapsibleContainer>
            ) : (
              <div className={`flex opacity-[70%] ${paragraph ? 'min-h-[100px]' : 'min-h-[20px]'}`}>
                <div className="flex opacity-[70%] min-h-[100px] break-words">
                  {typeof paragraph === 'string' && paragraph.length > 100
                    ? `${paragraph.slice(0, 100)}...`
                    : paragraph}
                </div>
              </div>
            )}
          </div>
        )}

        {children && (
          <div className={variant === 'slate' || variant === 'slateBorder' ? 'mt-6' : ''}>
            {children}
          </div>
        )}

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    )

  const wrapper =
    variant === 'gradient' ? (
      <span
        id="link-frame"
        className={`
        card-container min-w-[300px] w-[65vw] md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
        ${link ? 'cursor-pointer' : ''}
      `}
      >
        {onClick ? (
          <button onClick={onClick} className="w-full h-full block">
            {cardContent}
          </button>
        ) : link ? (
          <Link id="card-link" href={link} className="w-full h-full block">
            {cardContent}
          </Link>
        ) : (
          cardContent
        )}
      </span>
    ) : (
      <>
        {onClick ? (
          <button onClick={onClick} className="w-full h-full block">
            {cardContent}
          </button>
        ) : link ? (
          <Link href={link} className="w-full h-full block">
            {cardContent}
          </Link>
        ) : (
          cardContent
        )}
      </>
    )

  return wrapper
}
