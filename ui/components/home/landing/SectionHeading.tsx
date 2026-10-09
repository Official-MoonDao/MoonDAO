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
        <span className="inline-flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.28em] text-moon-gold">
          <span className="h-px w-6 bg-moon-gold/70" />
          {eyebrow}
          {isCenter ? <span className="h-px w-6 bg-moon-gold/70" /> : null}
        </span>
      </Reveal>
      <Reveal delay={0.1}>
        <h2
          className={`font-heading font-semibold leading-[1.15] text-2xl md:text-3xl lg:text-4xl ${
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
