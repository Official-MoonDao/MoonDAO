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
}) {
  function Icon() {
    return (
      <div
        id="benefit-icon-container"
        className="w-[150px] h-[150px] md:w-[200px] md:h-[200px] rounded-full flex items-center justify-center"
      >
        {typeof icon === 'string' ? (
          <Image
            id="benefit-icon-image"
            src={icon}
            alt="Icon"
            width={200}
            height={200}
          />
        ) : (
          <div id="benefit-icon-custom">{icon}</div>
        )}
      </div>
    )
  }

  return (
    <div
      id="benefit-container"
      className={`w-full flex gap-4 ${
        align === 'left' ? 'items-start' : 'items-end'
      }`}
    >
      <div id="benefit-content" className="flex gap-[5vw] items-center">
        {align === 'left' && <Icon />}
        <div id="benefit-text" className="flex flex-col gap-2">
          <h3 id="benefit-title" className="text-xl font-bold font-GoodTimes">
            {title}
          </h3>
          <p
            id="benefit-description"
            className="text-sm text-gray-500 max-w-[500px]"
          >
            {description}
          </p>
        </div>
        {align === 'right' && <Icon />}
      </div>
    </div>
  )
}
