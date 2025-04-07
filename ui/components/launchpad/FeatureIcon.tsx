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
      className={`px-[1vw] flex flex-col text-center w-full md:w-[27.5vw] h-auto items-center mb-[5vw] md:mb-[2vw]`}
      >
      <div className={`${gradient || numberBackground} rounded-full m-[2vw]`}>
        {typeof icon === 'string' ? (
          <div className="flex items-start mix-blend-screen justify-center w-fit h-fit rounded-full p-8 aspect-square">
            <Image
              className=""
              src={icon}
              alt={title}
              width={200}
              height={200}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-[120px] h-[120px] md:w-[150px] md:h-[150px] rounded-full">
            <div >
              {icon}
            </div>
          </div>
        )}
      </div>
      <h2 className="mt-[5vw] md:mt-[2vw] text-[4vw] md:text-[2vw] font-GoodTimes">
        {title}
      </h2>
      <p className="md:text-[min(1.2vw,16px)] 2xl:text-[18px]">
        {description}
      </p>
    </div>
  )
}
