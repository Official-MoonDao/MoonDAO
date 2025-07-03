import Image from 'next/image'

type FeatureIconProps = {
  title: string
  description: string
  icon: string | React.ReactNode
  gradient?: string
  numberBackground?: string
}

export default function FeatureIcon({
  title,
  description,
  icon,
  gradient,
  numberBackground,
}: FeatureIconProps) {
  return (
    <div
      className={`px-[1vw] pb-[3vw] md:pb-0 flex flex-col md:text-center w-full md:w-[20vw] h-auto items-center mb-[3vw] md:mb-[1vw]`}
    >
      <div className={`${gradient || numberBackground} rounded-full m-[1.5vw] md:m-[2vw]`}>
        {typeof icon === 'string' ? (
          <div className="flex items-start mix-blend-screen justify-center w-fit h-fit rounded-full p-4 md:p-6 aspect-square">
            <Image
              id="feature-icon-image"
              className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24"
              src={icon}
              alt={title}
              width={120}
              height={120}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-[120px] h-[120px] md:w-[150px] md:h-[150px] rounded-full">
            <div>{icon}</div>
          </div>
        )}
      </div>
      <div id="feature-icon-title" className="text-center">
        <h2 className="mt-[3vw] mb-[2vw] md:mt-0 md:mb-[1vw] text-[4vw] md:text-[1.5vw] font-GoodTimes font-semibold">
          {title}
        </h2>
        <p
          id="feature-icon-description"
          className="text-[3.5vw] md:text-[max(1vw,14px)] 2xl:text-[16px] text-gray-700 md:text-gray-600 leading-relaxed"
        >
          {description}
        </p>
      </div>
    </div>
  )
}
