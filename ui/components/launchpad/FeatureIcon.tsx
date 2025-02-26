import Image from 'next/image'

type FeatureIconProps = {
  title: string
  description: string
  icon: string | React.ReactNode
}

export default function FeatureIcon({
  title,
  description,
  icon,
}: FeatureIconProps) {
  return (
    <div className="flex flex-col text-center max-w-[300px] items-center">
      <div className="flex items-center justify-center w-fit h-fit gradient-2 rounded-full p-8 aspect-square">
        {typeof icon === 'string' ? (
          <Image
            className="w-125 h-125"
            src={icon}
            alt={title}
            width={125}
            height={125}
          />
        ) : (
          icon
        )}
      </div>
      <h2 className="mt-4 text-2xl font-GoodTimes">{title}</h2>
      <p>{description}</p>
    </div>
  )
}
