import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import useSWR from 'swr'
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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function LunarSimulatorScene() {
  const router = useRouter()
  const scenarioId = router.query.scenarioId as string | undefined

  const isDemo =
    !scenarioId || scenarioId === 'demo' || scenarioId === DEMO_SCENARIO.id

  const { data, error } = useSWR(
    isDemo || !scenarioId ? null : `/api/lunar-sim/scenarios/${scenarioId}`,
    fetcher
  )

  const scenario: Scenario | undefined = isDemo ? DEMO_SCENARIO : data?.scenario
  const notFound = !isDemo && (error || (data && !data.scenario))

  return (
    <>
      <Head
        title={scenario ? `${scenario.name} · Lunar Simulator` : 'Lunar Simulator'}
        description="Deterministic Campfire economy simulation on the lunar south pole."
        image="https://ipfs.io/ipfs/Qmc1FsD9pCw3FoYEQ1zviqXc3DQddyxte6cQ8hv6EvukFr"
      />
      <div className="h-[calc(100vh-4rem)] w-full">
        {scenario ? (
          <LunarSimulator scenario={scenario} soar={SEED_SOAR} siros={SEED_SIROS} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#05060a] text-white/60">
            {notFound ? (
              <>
                <p>Scenario not found.</p>
                <Link
                  href="/lunar-simulator"
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
                >
                  Back to scenarios
                </Link>
              </>
            ) : (
              <p>Loading scenario…</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
