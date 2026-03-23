import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { CITIZEN_TABLE_NAMES } from 'const/config'
import { BLOCKED_CITIZENS } from 'const/whitelist'
import { NativeTokenValue, useSuckers } from 'juice-sdk-react'
import { useMemo, useState } from 'react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { transformEventData } from '@/lib/juicebox/transformEventData'
import useOmnichainSubgraphProjectEvents from '@/lib/juicebox/useOmnichainSubgraphProjectEvents'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { tokenSymbolText } from '@/lib/utils/strings'
import Selector from '../layout/Selector'
import MissionActivityEvent from './MissionActivityEvent'

const MAX_CITIZEN_LOOKUP_ADDRESSES = 120

function isLikelyEthAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a)
}

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '—'
  if (amount >= 100_000) {
    return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
  if (amount >= 1) {
    return `$${amount.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`
  }
  return `$${amount.toLocaleString('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  })}`
}

function weiToEthUsdLabel(wei: bigint | undefined, ethPrice: number | null): string | null {
  if (ethPrice == null || wei === undefined) return null
  const eth = Number(wei) / 1e18
  if (!Number.isFinite(eth)) return null
  return formatUsd(eth * ethPrice)
}

function contributorAddressForEvent(event: any): string | undefined {
  if (event.type === 'addToBalanceEvent' && event.from) return event.from
  if (event.beneficiary) return event.beneficiary
  return undefined
}

export default function MissionActivityList({
  selectedChain,
  tokenSymbol,
  projectId,
  citizens: citizensProp = [],
}: any) {
  const [filter, setFilter] = useState<'all' | 'payEvent' | 'mintTokensEvent'>('all')

  const { data: suckers } = useSuckers()
  const { ethPrice } = useETHPrice(1, 'ETH_TO_USD')

  const {
    data: projectEventsQueryResult,
    isLoading: loadingEvents,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOmnichainSubgraphProjectEvents({
    filter: filter === 'all' ? undefined : filter,
    sucker: suckers?.find((s: any) => s.peerChainId === selectedChain.id),
    projectId,
  })

  const contributorAddressesKey = useMemo(() => {
    const set = new Set<string>()
    for (const page of projectEventsQueryResult?.pages ?? []) {
      for (const raw of page.data.activityEvents.items) {
        const ev = transformEventData(raw)
        if (!ev) continue
        const addr = contributorAddressForEvent(ev)
        if (addr && isLikelyEthAddress(addr)) {
          set.add(addr.toLowerCase())
        }
      }
    }
    const list = [...set].sort()
    return list.slice(0, MAX_CITIZEN_LOOKUP_ADDRESSES).join(',')
  }, [projectEventsQueryResult?.pages])

  const citizenLookupStatement = useMemo(() => {
    const chainSlug = getChainSlug(selectedChain)
    const table = CITIZEN_TABLE_NAMES[chainSlug]
    if (!table || !contributorAddressesKey) return null
    const addresses = contributorAddressesKey.split(',').filter(Boolean)
    if (addresses.length === 0) return null
    const inList = addresses.map((a) => `'${a}'`).join(',')
    const blocked = [...BLOCKED_CITIZENS]
    const blockedClause =
      blocked.length > 0 ? ` AND id NOT IN (${blocked.join(',')})` : ''
    return `SELECT id, name, owner, image FROM ${table} WHERE LOWER(owner) IN (${inList})${blockedClause}`
  }, [selectedChain, contributorAddressesKey])

  const { data: citizenRows } = useTablelandQuery(citizenLookupStatement, {
    revalidateOnFocus: false,
  })

  const citizens = useMemo(() => {
    const fromApi = (citizenRows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      owner: row.owner,
      image: row.image || null,
    }))
    const byOwner = new Map<string, (typeof fromApi)[0]>()
    for (const c of [...(citizensProp || []), ...fromApi]) {
      if (!c?.owner) continue
      byOwner.set(String(c.owner).toLowerCase(), c)
    }
    return [...byOwner.values()]
  }, [citizensProp, citizenRows])

  const projectEvents = useMemo(
    () =>
      projectEventsQueryResult?.pages
        .flatMap((page) => page.data.activityEvents.items)
        .map(transformEventData)
        .filter((event) => !!event)
        .filter((event) => event.type !== 'mintTokensEvent')
        .map((e) =>
          translateEventDataToPresenter(e, tokenSymbol, citizens, ethPrice)
        ) ?? [],
    [projectEventsQueryResult?.pages, tokenSymbol, citizens, ethPrice]
  )

  return (
    <div>
      <div className="flex flex-col gap-4 py-2">
        {projectEvents.map((event, i) => (
          <MissionActivityEvent
            key={event?.event.id + i}
            header={event?.header}
            subject={event?.subject}
            extra={event?.extra}
            address={event?.address}
            citizen={event?.citizen || null}
            event={event?.event}
          />
        ))}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full bg-gradient-to-br from-slate-700/20 to-slate-800/30 border border-white/10 hover:from-slate-600/30 hover:to-slate-700/40 hover:border-white/20 backdrop-blur-sm rounded-xl p-4 transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2 text-white/90 hover:text-white font-medium"
          >
            {isFetchingNextPage ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <ArrowDownIcon className="w-5 h-5" />
                <span>Load more</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function RichNote({ note }: { note: string }) {
  return <div className="text-sm break-words text-white/80 leading-relaxed">{note}</div>
}

function ethPaidInSubject(event: any, ethPrice: number | null) {
  const usdLabel = weiToEthUsdLabel(event.amount?.value, ethPrice)
  return (
    <span className="font-heading text-lg inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <NativeTokenValue decimals={8} wei={event.amount.value} />
      {usdLabel != null && (
        <span className="text-sm font-normal text-white/55">(~{usdLabel})</span>
      )}
    </span>
  )
}

function translateEventDataToPresenter(
  event: any,
  tokenSymbol: string | undefined,
  citizens: any[],
  ethPrice: number | null
) {
  const addr = contributorAddressForEvent(event)
  const citizen =
    addr &&
    citizens.find((c) => c.owner?.toLowerCase() === addr.toLowerCase())
  switch (event.type) {
    case 'payEvent':
      return {
        event,
        header: 'Paid',
        subject: ethPaidInSubject(event, ethPrice),
        extra: <RichNote note={event.memo} />,
        address: event.beneficiary,
        citizen: citizen,
      }
    case 'addToBalanceEvent':
      return {
        event,
        header: 'Added to balance',
        subject: ethPaidInSubject(event, ethPrice),
        extra: null,
        address: event.from,
        citizen: citizen,
      }
    case 'mintTokensEvent':
      return {
        event,
        header: 'Minted tokens',
        subject: (
          <span className="font-heading text-lg">
            To: {event.beneficiary.slice(0, 6) + '...' + event.beneficiary.slice(-4)}
          </span>
        ),
        extra: null,
        address: event.beneficiary,
        citizen: citizen,
      }

    case 'deployErc20Event':
      return {
        event,
        header: 'Deployed ERC20',
        subject: <span className="font-heading text-lg">{event.symbol}</span>,
        extra: null,
      }
    case 'projectCreateEvent':
      return {
        event,
        header: 'Created',
        subject: 'Project created 🎉',
        extra: null,
      }

    case 'burnEvent':
      return {
        event,
        header: 'Burned',
        subject: (
          <span className="font-heading text-lg">
            {Number(event.amount.toFloat())}{' '}
            {tokenSymbolText({
              tokenSymbol,
              plural: event.amount.toFloat() > 1,
            })}
          </span>
        ),
        extra: null,
      }
  }
}
