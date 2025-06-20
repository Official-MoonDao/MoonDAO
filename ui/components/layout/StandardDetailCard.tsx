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
    <div className="w-full flex items-center p-2 rounded-lg transition-colors">
      <span
        id="card-container"
        className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full rounded-[20px] shadow-lg shadow-darkest-cool/50 border border-darkest-cool/30 hover:shadow-xl hover:shadow-darkest-cool/70 hover:border-darkest-cool/50 transition-all duration-200`}
      >
        {/* Ensure the card content takes full height */}
        <div className="flex-grow">
          <div
            id="card-styling"
            className="bg-darkest-cool rounded-[20px] w-[20%] h-[20%] absolute top-0 left-0 pb-5"
          ></div>
          <span
            id="content-container"
            className={`h-full p-[20px] rounded-[20px] overflow-hidden flex flex-col justify-between border-b-[3px] border-x-[3px] border-darkest-cool`}
          >
            {/* check if image is blcb */}
            <div className="flex flex-row items-start gap-8">
              {image && (
                <div
                  id="team-citizen-image-container"
                  className="z-40 w-[150px] h-[150px]"
                >
                  <Frame noPadding marginBottom="0px" className="aspect-square">
                    <IPFSRenderer
                      className="w-full h-full object-cover rounded-full"
                      src={image}
                      width={50}
                      height={50}
                      alt={title || ''}
                    />
                  </Frame>
                </div>
              )}
              <div className="w-3/4 z-20">
                <h1 className="font-bold font-GoodTimes">{title}</h1>
                <p className="text-sm text-gray-500 overflow-hidden min-h-[80px]">
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
            card-container w-full md:w-full flex lg:flex-col rounded-[20px] relative overflow-hidden 
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
