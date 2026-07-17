import dynamic from 'next/dynamic'

// Client-only: thirdweb/SWR updates during SSR hydration trip React Suspense
// ("received an update before it finished hydrating") and the Next.js error
// overlay then intercepts all pointer events — which also blocked card clicks.
const DePrizeIndexContent = dynamic(
  () => import('../../components/deprize/DePrizeIndexContent'),
  {
    ssr: false,
    loading: () => (
      <div className="animate-fadeIn flex flex-col items-center py-24">
        <p className="text-gray-400">Loading DePrizes…</p>
      </div>
    ),
  }
)

export default function DePrizeIndexPage() {
  return <DePrizeIndexContent />
}
