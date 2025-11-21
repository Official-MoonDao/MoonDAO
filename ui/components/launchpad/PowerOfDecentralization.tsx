import Image from 'next/image'
import FeatureCard from './FeatureCard'

const features = [
  {
    title: 'Global Access',
    description: 'Tap into a global crypto network with trillions of dollars at your fingertips.',
    icon: '/assets/icon-globe.svg',
    gradientFrom: 'from-[#6C407D]',
    gradientTo: 'to-[#5F4BA2]',
  },
  {
    title: 'Trustless',
    description: 'All transactions are onchain, ensuring that everyone can see how funds are spent.',
    icon: '/assets/icon-signature.svg',
    gradientFrom: 'from-[#5F4BA2]',
    gradientTo: 'to-[#5159CC]',
  },
  {
    title: 'Battle Tested',
    description: 'Powered by Juicebox, a proven and audited platform with over 1,000+ projects and over $200,000,000+ raised.',
    icon: '/assets/icon-checkmark.svg',
    gradientFrom: 'from-[#5159CC]',
    gradientTo: 'to-[#4660E7]',
  },
  {
    title: 'Scalable',
    description: 'Adapt your fundraising strategy as your mission evolves with our quick launch guidelines and templates.',
    icon: '/assets/icon-scalable.svg',
    gradientFrom: 'from-[#4660E7]',
    gradientTo: 'to-[#6C407D]',
  },
  {
    title: 'Power of the Network',
    description: 'The Space Acceleration Network brings leading space companies, enthusiasts, and professionals onchain from around the globe.',
    icon: '/assets/icon-powerful.svg',
    gradientFrom: 'from-[#6C407D]',
    gradientTo: 'to-[#5F4BA2]',
  },
  {
    title: 'Internet Speed',
    description: 'Launch and fund your mission in minutes, not months, with instant global access to capital.',
    icon: '/assets/icon-fasttrack.svg',
    gradientFrom: 'from-[#5F4BA2]',
    gradientTo: 'to-[#5159CC]',
  },
]

export default function PowerOfDecentralization() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/assets/launchpad/Lunar-Satellites.png"
          alt="Lunar Satellites Background"
          fill
          className="object-cover object-center"
          priority
          quality={100}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="absolute top-8 md:top-16 lg:top-20 left-1/2 transform -translate-x-1/2 z-20 px-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-GoodTimes text-white text-center mb-2 md:mb-4">
            The Power of Decentralization
          </h2>
          <p className="text-white/80 text-sm md:text-base lg:text-lg xl:text-xl text-center max-w-3xl mx-auto">
            Experience the advantages of transparent, community-driven space funding.
          </p>
        </div>

        <div className="max-w-7xl mx-auto mt-32 md:mt-40 lg:mt-48 xl:mt-56">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 xl:gap-12">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
                gradientFrom={feature.gradientFrom}
                gradientTo={feature.gradientTo}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/50 to-transparent"></div>
      <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent"></div>
    </section>
  )
}

