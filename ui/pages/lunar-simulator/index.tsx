import { MoonIcon, PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import useSWR from 'swr'
import { DEMO_SCENARIO } from '@/lib/lunar-sim'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

type ScenarioCard = {
  id: string
  name: string
  description: string
  ownerType: string
  visibility: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Card({ scenario }: { scenario: ScenarioCard }) {
  return (
    <Link
      href={`/lunar-simulator/${scenario.id}`}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-cyan-400/40 hover:bg-white/10"
    >
      <div className="flex items-center gap-2">
        <MoonIcon className="h-5 w-5 text-cyan-300" />
        <span className="font-semibold text-white">{scenario.name}</span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-white/60">
        {scenario.description}
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
        <span className="rounded bg-white/10 px-2 py-0.5 capitalize">
          {scenario.visibility}
        </span>
        <span className="rounded bg-white/10 px-2 py-0.5 capitalize">
          {scenario.ownerType}
        </span>
      </div>
    </Link>
  )
}

export default function LunarSimulatorIndex() {
  const { data } = useSWR('/api/lunar-sim/scenarios', fetcher)
  const saved: ScenarioCard[] = data?.scenarios ?? []

  const demoCard: ScenarioCard = {
    id: DEMO_SCENARIO.id,
    name: DEMO_SCENARIO.name,
    description: DEMO_SCENARIO.description,
    ownerType: DEMO_SCENARIO.ownerType,
    visibility: DEMO_SCENARIO.visibility,
  }

  const cards = [demoCard, ...saved.filter((s) => s.id !== demoCard.id)]

  const description = (
    <div className="pt-2">
      <p className="mb-6 max-w-2xl text-white/80">
        MoonSim is a deterministic, in-browser simulation of a Campfire-style
        off-planet economy. Watch autonomous lunar assets discover each other,
        verify credentials against shared standards, and settle trustless,
        offline transactions on the lunar south pole.
      </p>
      <Link
        href="/lunar-simulator/new"
        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/30 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/40"
      >
        <PlusIcon className="h-4 w-4" />
        New Simulation
      </Link>
    </div>
  )

  return (
    <section id="lunar-simulator-container" className="overflow-hidden">
      <Head
        title="Lunar Simulator"
        description="A deterministic, in-browser simulation of a Campfire-style off-planet economy on the lunar south pole."
        image="https://ipfs.io/ipfs/Qmc1FsD9pCw3FoYEQ1zviqXc3DQddyxte6cQ8hv6EvukFr"
      />
      <Container>
        <ContentLayout
          header="Lunar Simulator"
          headerSize="max(20px, 3vw)"
          description={description}
          preFooter={<NoticeFooter />}
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
        >
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((s) => (
              <Card key={s.id} scenario={s} />
            ))}
          </div>
        </ContentLayout>
      </Container>
    </section>
  )
}
