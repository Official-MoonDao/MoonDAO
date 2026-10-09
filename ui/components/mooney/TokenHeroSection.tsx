import Image from 'next/image'
import React, { ReactNode } from 'react'

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
    <section className="relative min-h-[60svh] px-6 py-16 w-full flex items-center justify-center overflow-hidden">
      <div
        className="w-full h-full absolute top-0 left-0 bg-cover bg-no-repeat bg-center z-0"
        style={{ backgroundImage: `url("${backgroundImage}")` }}
      ></div>
      <div className="absolute inset-0 bg-black/40 z-1"></div>
      <div className="max-w-7xl mx-auto text-center space-y-5 relative z-10">
        <div className="flex justify-center">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={80}
            height={80}
            className="rounded-full shadow-2xl"
          />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-white">{title}</h1>

          <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
            {description}
          </p>

          {ctaButtons && (
            <div className="flex flex-wrap justify-center gap-4 pt-8">{ctaButtons}</div>
          )}
        </div>
      </div>
    </section>
  )
}
