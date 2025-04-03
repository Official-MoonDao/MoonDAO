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
      className={`flex flex-col text-center w-full md:w-[27.5vw] h-auto items-center`}
    >
      <div className={`${gradient || numberBackground} rounded-full m-[2vw]`}>
        {typeof icon === 'string' ? (
          <div className="flex items-start mix-blend-screen justify-center w-fit h-fit rounded-full p-8 aspect-square">
            <Image
              className=""
              src={icon}
              alt={title}
              width={300}
              height={300}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-[120px] h-[120px] md:w-[150px] md:h-[150px] rounded-full">
            <div className="text-[15vw] md:text-[3vw] font-GoodTimes text-white">
              {icon}
            </div>
          </div>
        )}
      </div>
      <h2 className="mt-[5vw] md:mt-[2vw] text-[5vw] md:text-[min(2vw,25px)] font-GoodTimes">
        {title}
      </h2>
      <p>{description}</p>
    </div>
  )
}
