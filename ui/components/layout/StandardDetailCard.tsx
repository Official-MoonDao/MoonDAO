import Image from 'next/image'
import Link from 'next/link'
import Frame from '@/components/layout/Frame'
import IPFSRenderer from './IPFSRenderer'

type StandardDetailCardProps = {
  title?: string
  paragraph?: string
  image?: string
  link?: string
  onClick?: () => void
}

export default function StandardDetailCard({
  title,
  paragraph,
  image,
  link,
  onClick,
}: StandardDetailCardProps) {
  const CardContent = (
    <div className="w-full flex items-center p-2 hover:bg-darkest-cool/20 rounded-lg transition-colors">
      <span
        id="card-container"
        className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full rounded-[20px] min-w-0`}
      >
        {/* Ensure the card content takes full height */}
        <div className="flex-grow w-full">
          <div
            id="card-styling"
            className="bg-darkest-cool rounded-[20px] w-[20%] h-[20%] absolute top-0 left-0 pb-5"
          ></div>
          <span
            id="content-container"
            className={`h-full p-[20px] rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-x-[3px] border-darkest-cool w-full`}
          >
            {/* check if image is blcb */}
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-8 w-full">
              {image && (
                <div
                  id="team-citizen-image-container"
                  className="z-40 w-[100px] h-[100px] sm:w-[150px] sm:h-[150px] flex-shrink-0"
                >
                  <Frame noPadding marginBottom="0px" className="aspect-square">
                    <IPFSRenderer
                      className="w-full h-full object-cover rounded-full"
                      src={image}
                      width={500}
                      height={500}
                      alt={title || ''}
                    />
                  </Frame>
                </div>
              )}
              <div className="flex-1 z-20 min-w-0">
                <h1 className="font-bold font-GoodTimes w-full break-words">
                  {title}
                </h1>
                <p className="text-sm text-gray-500 overflow-hidden min-h-[80px] break-words">
                  {paragraph && paragraph?.length > 200
                    ? paragraph.slice(0, 200) + '...'
                    : paragraph}
                </p>
              </div>
            </div>
          </span>
        </div>
      </span>
    </div>
  )

  return (
    <span
      id="link-frame"
      className={`
            card-container w-full flex lg:flex-col rounded-[20px] relative overflow-hidden min-w-0
            ${link ? 'cursor-pointer' : ''}
        `}
    >
      {link || onClick ? (
        <span
          id="Interactive-Element"
          className="clip absolute h-full w-full z-10"
        ></span>
      ) : (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-10"
        ></span>
      )}
      {!link && !onClick && (
        <span
          id="Static-Element"
          className="divider-8 absolute w-[80%] h-full z-10"
        ></span>
      )}

      {onClick ? (
        <button onClick={onClick} className="block">
          {CardContent}
        </button>
      ) : link ? (
        <Link href={link} className="block">
          {CardContent}
        </Link>
      ) : (
        CardContent
      )}
    </span>
  )
}
