import dynamic from 'next/dynamic'

export function SceneFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <span className="text-sm">Grading the plot…</span>
      </div>
    </div>
  )
}

// three.js cannot server-render, and the scene module carries every atlas model.
const LazyBuilderScene = dynamic(() => import('./BuilderScene'), {
  ssr: false,
  loading: () => <SceneFallback />,
})

export default LazyBuilderScene
