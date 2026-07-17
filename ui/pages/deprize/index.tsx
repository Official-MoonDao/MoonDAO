import { DEFAULT_CHAIN_V5 } from 'const/config'
import Link from 'next/link'
import { DePrizeState, DEPRIZE_STATE_META } from '@/lib/deprize/constants'
import { useDePrize, useDePrizeCount } from '@/lib/deprize/useDePrize'
import { getChainSlug } from '@/lib/thirdweb/chain'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'

function DePrizeListRow({ deprizeId }: { deprizeId: number }) {
  const chain = DEFAULT_CHAIN_V5
  const { deprize } = useDePrize(deprizeId, chain)

  if (deprize && deprize.state === DePrizeState.NONE) return null

  const meta = deprize ? DEPRIZE_STATE_META[deprize.state] : undefined
  const isOpen = deprize?.state === DePrizeState.OPEN

  return (
    <Link
      href={`/deprize/${deprizeId}`}
      className="block p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-blue-900/20 border border-white/10 hover:border-white/25 transition-colors"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-white font-GoodTimes text-lg">DePrize #{deprizeId}</p>
          <p className="text-gray-400 text-sm mt-1">
            {meta?.description ?? 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {deprize && (
            <span className="text-gray-400 text-xs">
              {deprize.teamIds.length} providers
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              isOpen
                ? 'bg-moon-green/20 text-moon-green border-moon-green/40'
                : 'bg-white/10 text-gray-200 border-white/20'
            }`}
          >
            {meta?.label ?? '—'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function DePrizeIndexPage() {
  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const { count, loading, registryConfigured } = useDePrizeCount(chain)

  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="DePrize"
        description="Back a provider to fly Frank White to space, and win if they do."
      />
      <Container>
        <ContentLayout
          header="DePrize"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          centerHeader
          centerHeaderWidth="760px"
          description="Bet on which provider wins the right to fly Frank White and a community Candidate to space. Every bet grows the prize."
          preFooter={<NoticeFooter />}
        >
          <div className="flex flex-col gap-4 w-full max-w-[760px] mx-auto">
            {!registryConfigured ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                The DePrize registry isn&apos;t configured on{' '}
                <span className="font-mono">{chainSlug}</span> yet.
              </div>
            ) : loading && count === undefined ? (
              <div className="p-8 text-center text-gray-400">Loading DePrizes…</div>
            ) : !count || count === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No DePrizes have been registered yet.
              </div>
            ) : (
              Array.from({ length: count }, (_, i) => (
                <DePrizeListRow key={i + 1} deprizeId={i + 1} />
              ))
            )}
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
