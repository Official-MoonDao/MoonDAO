import { ReactNode } from 'react'
import Reveal from './Reveal'

type SectionHeadingProps = {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  light?: boolean
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  light = false,
}: SectionHeadingProps) {
  const isCenter = align === 'center'
  return (
    <div
      className={`flex flex-col gap-4 ${
        isCenter ? 'items-center text-center' : 'items-start text-left'
      }`}
    >
      <Reveal>
        <span className="inline-flex items-center gap-3 font-RobotoMono text-xs tracking-[0.35em] uppercase text-[#7c8cff]">
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-[#7c8cff] to-[#22d3ee]" />
          {eyebrow}
          <span className="h-px w-8 bg-gradient-to-r from-[#22d3ee] via-[#7c8cff] to-transparent" />
        </span>
      </Reveal>
      <Reveal delay={0.1}>
        <h2
          className={`font-GoodTimes leading-[1.1] text-3xl md:text-4xl lg:text-5xl 2xl:text-6xl ${
            light ? 'text-dark-cool' : 'text-white'
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.2}>
          <p
            className={`max-w-2xl text-base md:text-lg leading-relaxed ${
              light ? 'text-dark-cool/70' : 'text-white/70'
            } ${isCenter ? 'mx-auto' : ''}`}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}
