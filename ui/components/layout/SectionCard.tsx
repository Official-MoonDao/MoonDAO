import Image from 'next/image'

type SectionCardProps = {
  id?: string
  className?: string
  children: React.ReactNode
  header?: string
  iconSrc?: string
  action?: React.ReactNode
}

export default function SectionCard({
  id,
  className = '',
  children,
  header,
  iconSrc,
  action,
}: SectionCardProps) {
  return (
    <div
      id={id}
      className={`mt-3 mb-0 md:mb-[5vw] 2xl:mb-[2vw] px-5 lg:px-10 xl:px-10 py-5 bg-[#020617] rounded-2xl w-full lg:mt-10 lg:w-full lg:max-w-[1200px] flex flex-col ${className}`}
    >
      <div className="flex justify-between">
        <div className="flex gap-5 items-center opacity-50">
          {iconSrc && (
            <Image src={iconSrc} alt="Job icon" width={30} height={30} />
          )}
          {header && <h2 className="header font-GoodTimes">{header}</h2>}
        </div>
        {action && action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}
