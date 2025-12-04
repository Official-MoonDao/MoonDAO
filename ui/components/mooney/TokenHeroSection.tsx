import React, { ReactNode } from 'react'
import Image from 'next/image'

export interface TokenHeroSectionProps {
  title: string
  description: string
  imageSrc: string
  imageAlt: string
  backgroundImage?: string
  ctaButtons?: ReactNode
}

export default function TokenHeroSection({
  title,
  description,
  imageSrc,
  imageAlt,
  backgroundImage = '/assets/ngc6357_4k.webp',
  ctaButtons,
}: TokenHeroSectionProps) {
  return (
    <section className="relative min-h-screen px-6 w-full flex items-center justify-center overflow-hidden">
      <div
        className="w-full h-full absolute top-0 left-0 bg-cover bg-no-repeat bg-center z-0"
        style={{ backgroundImage: `url("${backgroundImage}")` }}
      ></div>
      <div className="absolute inset-0 bg-black/40 z-1"></div>
      <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10 -mt-20">
        <div className="flex justify-center">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={120}
            height={120}
            className="rounded-full shadow-2xl"
          />
        </div>
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold font-GoodTimes text-white">
            {title}
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            {description}
          </p>

          {ctaButtons && (
            <div className="flex flex-wrap justify-center gap-4 pt-8">
              {ctaButtons}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

