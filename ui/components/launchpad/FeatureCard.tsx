import Image from 'next/image'

type FeatureCardProps = {
  title: string
  description: string
  icon: string
  gradientFrom: string
  gradientTo: string
}

export default function FeatureCard({
  title,
  description,
  icon,
  gradientFrom,
  gradientTo,
}: FeatureCardProps) {
  return (
    <div className="relative group h-64 md:h-72 lg:h-80 w-full">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl md:rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300`}
      ></div>
      <div className="relative bg-black/40 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 border border-white/10 hover:border-white/30 transition-all duration-300 h-full w-full">
        <div className="flex flex-col items-center text-center space-y-3 md:space-y-4 lg:space-y-6">
          <div
            className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl md:rounded-2xl p-2 md:p-3 lg:p-4 group-hover:scale-110 transition-transform duration-300`}
          >
            <Image
              src={icon}
              alt={title}
              width={48}
              height={48}
              className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12"
            />
          </div>
          <div>
            <h3 className="text-lg md:text-xl lg:text-2xl font-GoodTimes text-white mb-2 md:mb-3">
              {title}
            </h3>
            <p className="text-white/80 text-xs md:text-sm lg:text-base leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

