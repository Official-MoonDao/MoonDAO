import Image from 'next/image'

export default function LaunchpadBenefit({
  title,
  description,
  icon,
  align = 'left',
}: {
  title: string
  description: string
  icon: string | React.ReactNode
  align?: 'left' | 'right'
}) {
  function Icon() {
    if (typeof icon === 'string') {
      return (
        <Image
          src={icon}
          alt="Benefit Icon"
          width={80}
          height={80}
          className="object-contain w-20 h-20 md:w-24 md:h-24"
          id="benefit-icon-image"
        />
      )
    }
    return <div id="benefit-icon-custom">{icon}</div>
  }

  const isRightAligned = align === 'right'

  return (
    <div
      id="benefit-container"
      className={`w-full flex flex-row items-start gap-6 md:gap-10 mb-12 last:mb-0 ${
        isRightAligned ? 'flex-row-reverse' : ''
      }`}
    >
      <div 
        id="benefit-icon-container"
        className="flex-shrink-0 w-20 md:w-24 flex items-start justify-start"
      >
        <Icon />
      </div>
      <div 
        id="benefit-content"
        className="flex-1 text-left md:flex-none md:w-96"
      >
        <div id="benefit-text">
          <h4 id="benefit-title" className="font-bold text-lg md:text-2xl mb-2 text-left text-white">{title}</h4>
          <p id="benefit-description" className="text-gray-300 text-sm md:text-base max-w-sm md:max-w-xs text-left">{description}</p>
        </div>
      </div>
    </div>
  )
}
