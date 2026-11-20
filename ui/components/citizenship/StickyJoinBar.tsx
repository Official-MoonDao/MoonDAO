import { RefObject, useEffect, useState } from 'react'
import CtaButton from '@/components/home/landing/CtaButton'

type StickyJoinBarProps = {
  price: string
  href: string
  /** Show the bar once this element has scrolled out of view (the hero CTA). */
  showAfter: RefObject<HTMLElement>
  /** Hide the bar while this element is on screen (the offer card). */
  hideWhile: RefObject<HTMLElement>
}

/**
 * Mobile-only bottom bar that keeps "Become a Citizen" in reach after the
 * hero button scrolls away. Hidden on larger screens and over the offer card.
 */
export default function StickyJoinBar({ price, href, showAfter, hideWhile }: StickyJoinBarProps) {
  const [pastHero, setPastHero] = useState(false)
  const [offerVisible, setOfferVisible] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observers: IntersectionObserver[] = []
    if (showAfter.current) {
      const o = new IntersectionObserver(([entry]) =>
        setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      )
      o.observe(showAfter.current)
      observers.push(o)
    }
    if (hideWhile.current) {
      const o = new IntersectionObserver(([entry]) => setOfferVisible(entry.isIntersecting))
      o.observe(hideWhile.current)
      observers.push(o)
    }
    return () => observers.forEach((o) => o.disconnect())
  }, [showAfter, hideWhile])

  const visible = pastHero && !offerVisible

  return (
    <div
      aria-hidden={!visible}
      data-cta-location="paid_landing_sticky"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#010208]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="text-sm leading-tight text-white/80">
          <div className="font-semibold text-white">{price}</div>
          <div className="text-xs text-white/55">12-month Citizenship</div>
        </div>
        <CtaButton href={href} variant="primary" className="!px-5 !py-3 !text-sm">
          Become a Citizen
        </CtaButton>
      </div>
    </div>
  )
}
