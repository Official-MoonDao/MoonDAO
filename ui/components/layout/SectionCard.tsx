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
      className={`bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg mb-6 transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl w-full ${className}`}
    >
      <div className="flex justify-between">
        <div className="flex gap-5 items-center">
          {iconSrc && (
            <Image src={iconSrc} alt="Section icon" width={30} height={30} />
          )}
          {header && <h2 className="text-white font-GoodTimes text-2xl lg:text-3xl">{header}</h2>}
        </div>
        {action && action}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}
