import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { DEMO_SCENARIO, SEED_SIROS, SEED_SOAR } from '@/lib/lunar-sim'
import type { Scenario } from '@/lib/lunar-sim/engine/types'
import Head from '@/components/layout/Head'

const LunarSimulator = dynamic(
  () => import('@/components/lunar-sim/LunarSimulator'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#05060a] text-white/60">
        Loading simulator…
      </div>
    ),
  }
)

// MVP authoring: start from the demo as an editable template. The scenario
// builder UI and Save/Fork (IPFS + Tableland) are wired by the persistence
// layer; this page already runs the engine on the draft.
export default function NewLunarScenario() {
  const draft: Scenario = useMemo(
    () => ({
      ...DEMO_SCENARIO,
      id: `draft-${Date.now()}`,
      name: 'Untitled Lunar Scenario',
      visibility: 'private',
    }),
    []
  )

  return (
    <>
      <Head
        title="New Scenario · Lunar Simulator"
        description="Author a new Campfire economy scenario on the lunar south pole."
        image="https://ipfs.io/ipfs/Qmc1FsD9pCw3FoYEQ1zviqXc3DQddyxte6cQ8hv6EvukFr"
      />
      <div className="h-[calc(100vh-4rem)] w-full">
        <LunarSimulator scenario={draft} soar={SEED_SOAR} siros={SEED_SIROS} />
      </div>
    </>
  )
}
