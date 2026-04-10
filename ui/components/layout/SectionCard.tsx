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
      className={`md:bg-gradient-to-br md:from-slate-700/20 md:to-slate-800/30 md:backdrop-blur-xl md:border md:border-white/10 md:rounded-xl px-4 py-3 md:p-6 md:shadow-lg transition-all duration-300 md:hover:bg-gradient-to-br md:hover:from-slate-600/30 md:hover:to-slate-700/40 md:hover:shadow-xl w-full ${className}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex gap-2 sm:gap-3 md:gap-5 items-center min-w-0">
          {iconSrc && <Image src={iconSrc} alt="Section icon" width={24} height={24} className="flex-shrink-0 sm:w-[30px] sm:h-[30px]" />}
          {header && (
            <h2 className="text-white font-GoodTimes text-2xl sm:text-3xl lg:text-4xl truncate">{header}</h2>
          )}
        </div>
        {action && <div className="flex-shrink-0 ml-2">{action}</div>}
      </div>
      <div className="mt-3 sm:mt-6">{children}</div>
    </div>
  )
}
