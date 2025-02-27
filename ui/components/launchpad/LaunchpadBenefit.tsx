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
      <div className="w-[150px] h-[150px] md:w-[200px] md:h-[200px] rounded-full flex items-center justify-center">
        {typeof icon === 'string' ? (
          <Image src={icon} alt="Icon" width={200} height={200} />
        ) : (
          icon
        )}
      </div>
    )
  }

  return (
    <div
      className={`w-full flex gap-4 ${
        align === 'left' ? 'items-start' : 'items-end'
      }`}
    >
      <div className="flex gap-[5vw] items-center">
        {align === 'left' && <Icon />}
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold font-GoodTimes">{title}</h3>
          <p className="text-sm text-gray-500 max-w-[500px]">{description}</p>
        </div>
        {align === 'right' && <Icon />}
      </div>
    </div>
  )
}
