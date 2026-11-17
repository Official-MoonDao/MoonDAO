import { TOUR_ORDER, type TourStopId } from '@/lib/moonbase-tour/stops'

// A chapter's card is still fading in when its section reaches the top of the
// screen and only settles about a third of a screen later (see TourChapter),
// so a jump lands there rather than on a half-faded card.
const SETTLED_SVH = 0.3

export function isTourStopId(value: string): value is TourStopId {
  return (TOUR_ORDER as string[]).includes(value)
}

// The stop a URL hash names, as in /moonbase/tour#power, or null.
export function stopFromHash(hash: string): TourStopId | null {
  const id = decodeURIComponent(hash.replace(/^#/, ''))
  return isTourStopId(id) ? id : null
}

export function scrollToStop(id: TourStopId, behavior: ScrollBehavior = 'smooth') {
  const el = document.querySelector<HTMLElement>(`[data-tour-stop="${id}"]`)
  if (!el) return
  const top =
    id === TOUR_ORDER[0]
      ? 0
      : el.getBoundingClientRect().top + window.scrollY + window.innerHeight * SETTLED_SVH
  window.scrollTo({ top, behavior })
}
