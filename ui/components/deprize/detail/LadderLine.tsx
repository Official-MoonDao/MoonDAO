import {
  CAPABILITY_LADDER_SPEC_HREF,
  getLadderForCompetition,
} from '@/lib/deprize/capabilityLadder'

export default function LadderLine({
  chainSlug,
  deprizeId,
}: {
  chainSlug: string
  deprizeId?: number
}) {
  if (deprizeId == null) return null
  const ladder = getLadderForCompetition(chainSlug, deprizeId)
  const current = ladder.rungs.find((rung) => rung.current)
  if (!ladder.currentKey || !current) return null
  return (
    <p className="text-sm text-gray-300">
      Rung {current.rung} of {ladder.rungs.length} · {current.label} — {current.bar} ·{' '}
      <a
        href={CAPABILITY_LADDER_SPEC_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-300/90 underline-offset-2 hover:underline hover:text-indigo-200"
      >
        Read the capability ladder →
      </a>
    </p>
  )
}
