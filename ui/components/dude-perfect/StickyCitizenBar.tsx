import { useEffect, useState } from 'react'
import { CitizenOffer } from '@/lib/citizen/useCitizenOffer'
import CtaButton from '@/components/home/landing/CtaButton'

/**
 * Mobile-only bar that keeps the primary action in reach once the hero has
 * scrolled away. It hides again while the offer section is on screen, where
 * the same button is already visible.
 */
export default function StickyCitizenBar({ offer }: { offer: CitizenOffer }) {
  const [pastHero, setPastHero] = useState(false)
  const [offerVisible, setOfferVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('dp-hero')
    if (!hero) return

    const heroObserver = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), {
      threshold: 0,
    })
    heroObserver.observe(hero)

    let offerObserver: IntersectionObserver | undefined
    const observeOffer = (offerEl: HTMLElement) => {
      offerObserver = new IntersectionObserver(([entry]) => setOfferVisible(entry.isIntersecting))
      offerObserver.observe(offerEl)
    }

    const offerEl = document.getElementById('join')
    let offerWatcher: MutationObserver | undefined
    if (offerEl) {
      observeOffer(offerEl)
    } else {
      // OfferSection is code-split; its skeleton has no #join, so client-side
      // navigations can mount this bar before the offer node exists.
      offerWatcher = new MutationObserver(() => {
        const el = document.getElementById('join')
        if (!el) return
        observeOffer(el)
        offerWatcher?.disconnect()
      })
      offerWatcher.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      heroObserver.disconnect()
      offerObserver?.disconnect()
      offerWatcher?.disconnect()
    }
  }, [])

  const visible = pastHero && !offerVisible

  return (
    <div
      aria-hidden={!visible}
      data-cta-location="dp_sticky"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#010208]/90 px-4 py-3 backdrop-blur-xl transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-tight text-white/70">
          {offer.isCitizen ? (
            'Welcome back, citizen.'
          ) : (
            <>
              12-month passport
              <br />
              {offer.yearLabel}
            </>
          )}
        </p>
        <CtaButton
          href={offer.ctaHref}
          variant="primary"
          className="flex-shrink-0 whitespace-nowrap !px-5 !py-2.5 !text-sm"
        >
          {offer.ctaLabel}
        </CtaButton>
      </div>
    </div>
  )
}
