/**
 * Catch: a one-minute 3D game. Guide a Starship upper stage into the launch
 * tower's arms at Starbase. Chromeless like /touchdown (see Layout).
 */
import dynamic from 'next/dynamic'

const CatchGame = dynamic(() => import('@/components/catch/CatchGame'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-black text-sm font-semibold tracking-widest text-white/60">
      ROLLING OUT TO THE PAD…
    </div>
  ),
})

export default function CatchPage() {
  return <CatchGame />
}
