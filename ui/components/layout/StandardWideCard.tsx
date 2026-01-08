import Image from 'next/image'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import StandardButton from '../layout/StandardButton'
import IPFSRenderer from './IPFSRenderer'

type StandardWideCardProps = {
  header?: string
  title?: any
  paragraph?: ReactNode
  fullParagraph?: boolean
  link?: string
  onClick?: () => void
  orgimage?: string
  subheader?: any
  image?: string
  secondaryImage?: string
  stats?: any
  profile?: boolean
  footer?: any
  height?: string
  showMore?: boolean
  showMoreButton?: boolean
  compact?: boolean
}

export default function StandardWideCard({
  header,
  title,
  paragraph,
  fullParagraph = true,
  link,
  onClick,
  orgimage,
  subheader,
  image,
  secondaryImage,
  stats,
  profile = false,
  footer,
  showMore = false,
  showMoreButton = true,
  compact = false,
}: StandardWideCardProps) {
  const [isExpanded, setIsExpanded] = useState(showMore)

  const cardContent = (
    <div>
      <span
        id="card-container"
        className={`relative animate-fadeIn flex flex-col relative bg-dark-cool rounded-[20px] w-full h-full ${
          showMoreButton ? 'pb-4' : ''
        }`}
      >
        {/* Ensure the card content takes full height */}
        <div className="flex-grow">
          <div
            id="card-styling"
            className="bg-dark-cool rounded-[20px] w-full h-full absolute top-0 left-0"
          ></div>
          <span
            id="content-container"
            className={`h-full md:p-[32px] rounded-[20px] overflow-hidden flex flex-col justify-between bg-slate-800/50`}
          >
            <span
              id="content"
              className={`animate-fadeIn relative z-50 flex flex-col gap-6 ${
                showMoreButton ? 'pb-8' : ''
              }`}
            >
              <div className="relative flex flex-col lg:flex-row gap-4 items-center">
                {/* Image section */}
                {(image || orgimage) && (
                  <div className="relative w-full h-full md:w-[275px] md:h-[275px] md:mx-8">
                    <div className="relative w-full h-full md:w-[275px] md:h-[275px] md:rounded-full overflow-hidden bg-gray-300 flex-shrink-0">
                      {image ? (
                        typeof image !== 'string' || image?.startsWith('blob:') ? (
                          <Image
                            className="w-full h-full object-cover"
                            src={image}
                            alt={title || ''}
                            width={200}
                            height={200}
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 275px, 200px"
                            loading="lazy"
                          />
                        ) : (
                          <IPFSRenderer
                            className="w-full h-full object-cover"
                            src={image}
                            width={200}
                            height={200}
                            alt={title || ''}
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 275px, 200px"
                            loading="lazy"
                          />
                        )
                      ) : (
                        orgimage && (
                          <Image
                            src={orgimage}
                            alt={title || ''}
                            width={200}
                            height={200}
                            className="w-full h-full object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 275px, 200px"
                            loading="lazy"
                          />
                        )
                      )}
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
                  {/* Title and tagline section */}
                  <div className="flex flex-col gap-2">
                    <h2 className="font-GoodTimes text-2xl text-white">
                      {header || title || (profile && 'Anon')}
                    </h2>
                    {subheader && <div className="text-gray-400 text-lg">{subheader}</div>}
                  </div>
                  {stats && <div className="mt-4 flex flex-row gap-4">{stats}</div>}
                </div>
              </div>

              {/* Description section */}
              <div
                className={`text-gray-300 overflow-hidden ${
                  isExpanded ? 'h-full' : 'max-h-[100px]'
                }`}
              >
                {fullParagraph || typeof paragraph !== 'string'
                  ? paragraph
                  : paragraph?.slice(0, 100)}
              </div>

              {/* Add Show More button */}

              {footer && <div className="mt-4">{footer}</div>}
            </span>
          </span>
        </div>
      </span>
      {fullParagraph && showMoreButton && (
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
      )}
    </div>
  )

  return (
    <span
      id="link-frame"
      className={`
                card-container w-full flex lg:flex-col rounded-[20px] relative  p-2 ${
                  link || onClick ? 'hover-gradient-2 cursor-pointer' : ''
                }
            `}
    >
      {onClick ? (
        <div onClick={onClick} className="w-full h-full block">
          {cardContent}
        </div>
      ) : link ? (
        <Link id="card-link" href={link} className="w-full h-full block">
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
    </span>
  )
}
