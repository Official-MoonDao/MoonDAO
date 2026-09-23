import type { ReactNode } from 'react'

/**
 * The bordered panel both `/updates` and `/updates/<slug>` sit in. Shared so
 * the index and a post are always exactly the same width.
 */
export default function UpdatesPanel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1200px] rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 shadow-2xl backdrop-blur-xl md:mb-[5vw] 2xl:mb-[2vw] ${className}`}
    >
      {children}
    </div>
  )
}
