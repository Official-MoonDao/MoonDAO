import Image from 'next/image'

type FeatureIconProps = {
  title: string
  description: string
  icon: string | React.ReactNode
  gradient?: string
}

export default function FeatureIcon({
  title,
  description,
  icon,
  gradient,
}: FeatureIconProps) {
  return (
    <div
      className={`flex flex-col text-center w-full md:w-[27.5vw] h-auto items-center mb-[5vw] md:mb-[2vw]  `}
    >
      <div className={`${gradient} rounded-full m-[] m-[2vw]`}>
      <div className="flex items-start mix-blend-screen justify-center w-fit h-fit rounded-full p-8 aspect-square">
        {typeof icon === 'string' ? (
          <Image
            className=""
            src={icon}
            alt={title}
            width={300}
            height={300}
          />
        ) : (
          <div id="feature-icon-custom">{icon}</div>
        )}
      </div>
      </div>
      <h2 className="mt-4 text-2xl font-GoodTimes">{title}</h2>
      <p className="md:text-[1.2vw]">{description}</p>
    </div>
  )
}
