import Image from 'next/image'

type AchievementCardProps = {
  value: string | number
  label: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function AchievementCard({
  value,
  label,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: AchievementCardProps) {
  return (
    <div
      className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} backdrop-blur-sm rounded-2xl md:rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group`}
    >
      <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
        <div className={`bg-gradient-to-br ${gradientFrom.replace('/20', '')} ${gradientTo.replace('/20', '')} rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300`}>
          <Image
            src={icon}
            alt={label}
            width={48}
            height={48}
            className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
          />
        </div>
        <div>
          <h3 className="text-base md:text-xl lg:text-2xl font-GoodTimes text-white mb-1 md:mb-2">
            {value}
            <br />
            {label}
          </h3>
          <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

