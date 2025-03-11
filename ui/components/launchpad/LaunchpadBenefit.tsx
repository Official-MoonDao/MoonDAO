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
  align: 'left' | 'right'
  slideDirection?: 'left' | 'right'
}) {
  function Icon() {
    return (
      <div
        id="benefit-icon-container"
        className="w-[max(20vw,260px)] h-[max(20vw,260px)] pb-[5vw] md:pb-0 md:w-[max(25vw,250px)] md:h-[max(25vw,250px)] rounded-full flex items-center justify-center"
      >
        {typeof icon === 'string' ? (
          <Image
            id="benefit-icon-image"
            src={icon}
            alt="Icon"
            width={200}
            height={200}
            className="w-[60vw] h-[60vw] md:w-[max(20vw,200px)] md:h-[max(20vw,200px)]"
          />
        ) : (
          <div id="benefit-icon-custom" className="w-[35vw] md:w-[20vw]">
            {icon}
          </div>
        )}
      </div>
    )
  }

  return (
    <div id="benefit-container" className="w-full flex items-center">
      <div
        id="benefit-content"
        className="flex flex-col md:flex-row items-center justify-center w-full"
      >
        <div className="block md:hidden">
          <Icon />
        </div>
        {align === 'left' && (
          <div className="hidden md:block">
            <Icon />
          </div>
        )}
        <div
          id="benefit-text"
          className={`flex flex-col items-center ${
            align === 'left'
              ? 'md:items-start text-center md:text-left pl-[5vw] pr-[5vw] md:pl-[2vw] md:pr-0'
              : 'md:items-end text-center md:text-right pr-[5vw] pl-[5vw] md:pr-[2vw] md:pl-0'
          }`}
        >
          <h3
            id="benefit-title"
            className="text-[4vw] text-[5vw] md:text-[2vw] font-bold font-GoodTimes "
          >
            {title}
          </h3>
          <p
            id="benefit-description"
            className="md:max-w-[35vw] text-[3vw] md:text-[1.2vw] text-gray-500"
          >
            {description}
          </p>
        </div>
        {align === 'right' && (
          <div className="hidden md:block">
            <Icon />
          </div>
        )}
      </div>
    </div>
  )
}
