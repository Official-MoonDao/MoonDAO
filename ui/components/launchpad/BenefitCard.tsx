import Image from 'next/image'

type BenefitCardProps = {
  title: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function BenefitCard({
  title,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: BenefitCardProps) {
  return (
    <div
      className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} backdrop-blur-sm rounded-3xl p-4 md:p-6 lg:p-8 border border-white/20 hover:border-white/40 transition-all duration-300 group h-full`}
    >
      <div className="flex flex-col items-center text-center space-y-4 md:space-y-6 h-full">
        <div className={`bg-gradient-to-br ${gradientFrom.replace('/40', '')} ${gradientTo.replace('/60', '')} rounded-full p-3 md:p-4 group-hover:scale-110 transition-transform duration-300`}>
          <Image
            src={icon}
            alt={title}
            width={48}
            height={48}
            className="w-10 h-10 md:w-12 md:h-12 lg:w-16 lg:h-16"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-GoodTimes text-white mb-2 md:mb-4">
            {title}
          </h3>
          <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

