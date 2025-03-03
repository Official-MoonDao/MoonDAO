import Image from 'next/image'

type FeatureIconProps = {
  title: string
  description: string
  icon: string | React.ReactNode
  className?: string
}

export default function FeatureIcon({
  title,
  description,
  icon,
  className,
}: FeatureIconProps) {
  return (
    <div
      id="feature-icon-container"
      className={`flex flex-col text-center max-w-[300px] items-center ${className}`}
    >
      <div
        id="feature-icon-circle"
        className="flex items-center justify-center w-fit h-fit gradient-2 rounded-full p-8 aspect-square"
      >
        {typeof icon === 'string' ? (
          <Image
            id="feature-icon-image"
            className="w-125 h-125"
            src={icon}
            alt={title}
            width={125}
            height={125}
          />
        ) : (
          <div id="feature-icon-custom">{icon}</div>
        )}
      </div>
      <h2 id="feature-icon-title" className="mt-4 text-2xl font-GoodTimes">
        {title}
      </h2>
      <p id="feature-icon-description">{description}</p>
    </div>
  )
}
