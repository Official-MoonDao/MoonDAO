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
      className={`md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30 md:backdrop-blur-xl md:border md:border-white/10 md:rounded-xl py-2 md:p-6 md:shadow-lg transition-all duration-300 md:hover:bg-gradient-to-br md:hover:from-slate-600/30 md:hover:to-slate-700/40 md:hover:shadow-xl w-full ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-0">
        <div className="flex gap-3 md:gap-5 items-center">
          {iconSrc && <Image src={iconSrc} alt="Section icon" width={30} height={30} />}
          {header && (
            <h2 className="text-white font-GoodTimes text-xl sm:text-2xl lg:text-3xl">{header}</h2>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}
