import { MediaRenderer } from 'thirdweb/react'
import client from '@/lib/thirdweb/client'
import Frame from '@/components/layout/Frame'

type StandardDetailCardProps = {
  title?: string
  paragraph?: string
  image?: string
}

export default function StandardDetailCard({
  title,
  paragraph,
  image,
}: StandardDetailCardProps) {
  return (
    <div className="w-full flex items-center p-2 hover:bg-darkest-cool/20 rounded-lg transition-colors">
      <span
        id="card-container"
        className={`animate-fadeIn flex flex-col relative bg-dark-cool w-full h-full md:max-w-[600px] rounded-[20px]`}
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
                  className="z-40 w-[75px] h-[75px]"
                >
                  <Frame noPadding marginBottom="0px" className="aspect-square">
                    <MediaRenderer
                      className="w-full h-full object-cover rounded-full"
                      client={client}
                      src={image}
                      width="50px"
                      height="50px"
                    />
                  </Frame>
                </div>
              )}
              <div className="w-3/4">
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
}
