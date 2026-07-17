import { useClientHydrated } from '@/lib/utils/hooks/useClientHydrated'
import DePrizeIndexContent from '@/components/deprize/DePrizeIndexContent'

/**
 * Gate the list until after hydration so thirdweb/SWR updates cannot race
 * Layout's dynamic() Suspense boundaries (which surfaces as an unhandled
 * "Suspense boundary received an update before it finished hydrating" error
 * and a Next.js overlay that intercepts all pointer events).
 */
export default function DePrizeIndexPage() {
  const hydrated = useClientHydrated()
  if (!hydrated) {
    return (
      <div className="animate-fadeIn flex flex-col items-center py-24">
        <p className="text-gray-400">Loading DePrizes…</p>
      </div>
    )
  }
  return <DePrizeIndexContent />
}
