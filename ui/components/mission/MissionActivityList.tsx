import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { NativeTokenValue, useSuckers } from 'juice-sdk-react'
import { useMemo, useState } from 'react'
import { transformEventData } from '@/lib/juicebox/transformEventData'
import useOmnichainSubgraphProjectEvents from '@/lib/juicebox/useOmnichainSubgraphProjectEvents'
import { tokenSymbolText } from '@/lib/utils/strings'
import Selector from '../layout/Selector'
import MissionActivityEvent from './MissionActivityEvent'

export default function MissionActivityList({
  selectedChain,
  tokenSymbol,
  projectId,
  citizens,
}: any) {
  const [filter, setFilter] = useState<'all' | 'payEvent' | 'mintTokensEvent'>(
    'all'
  )

  const { data: suckers, refetch } = useSuckers()

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

  const projectEvents = useMemo(
    () =>
      projectEventsQueryResult?.pages
        .flatMap((page) => page.data.activityEvents.items)
        .map(transformEventData)
        .filter((event) => !!event)
        .map((e) => translateEventDataToPresenter(e, tokenSymbol, citizens)) ??
      [],
    [projectEventsQueryResult?.pages, tokenSymbol, citizens]
  )

  return (
    <div>
      <div className="flex justify-end items-center gap-4">
        <Selector
          value={filter}
          onChange={(value) => {
            setFilter(value as 'all' | 'payEvent' | 'mintTokensEvent')
          }}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Contributions', value: 'payEvent' },
            { label: 'Tokens', value: 'mintTokensEvent' },
          ]}
        />
      </div>
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
  return (
    <div className="text-sm break-words text-white/80 leading-relaxed">
      {note}
    </div>
  )
}

function translateEventDataToPresenter(
  event: any,
  tokenSymbol: string | undefined,
  citizens: any[]
) {
  const citizen = citizens.find(
    (citizen) =>
      citizen.owner.toLowerCase() == event?.beneficiary?.toLowerCase()
  )
  switch (event.type) {
    case 'payEvent':
      return {
        event,
        header: 'Paid',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: <RichNote note={event.memo} />,
        citizen: citizen,
      }
    case 'addToBalanceEvent':
      return {
        event,
        header: 'Added to balance',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: null,
      }
    case 'mintTokensEvent':
      return {
        event,
        header: 'Minted tokens',
        subject: (
          <span className="font-heading text-lg">
            To:{' '}
            {event.beneficiary.slice(0, 6) +
              '...' +
              event.beneficiary.slice(-4)}
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
