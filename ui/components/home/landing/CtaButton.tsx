import Link from 'next/link'
import { ReactNode } from 'react'

type CtaButtonProps = {
  children: ReactNode
  href: string
  variant?: 'primary' | 'secondary'
  target?: string
  className?: string
}

export default function CtaButton({
  children,
  href,
  variant = 'primary',
  target,
  className = '',
}: CtaButtonProps) {
  const base =
    'group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm md:text-base font-semibold tracking-wide transition-all duration-300 will-change-transform'

  const variants = {
    primary:
      'bg-white text-black hover:scale-[1.04] hover:shadow-[0_0_40px_rgba(124,140,255,0.45)]',
    secondary:
      'border border-white/25 bg-white/5 text-white backdrop-blur-md hover:border-white/50 hover:bg-white/10 hover:scale-[1.04]',
  }

  return (
    <Link
      href={href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      className={`${base} ${variants[variant]} ${className}`}
    >
      <span>{children}</span>
      <svg
        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </Link>
  )
}
