import { NativeTokenValue, useSuckers } from 'juice-sdk-react'
import { useMemo, useState } from 'react'
import { transformEventData } from '@/lib/juicebox/transformEventData'
import useOmnichainSubgraphProjectEvents from '@/lib/juicebox/useOmnichainSubgraphProjectEvents'
import { tokenSymbolText } from '@/lib/utils/strings'
import Selector from '../layout/Selector'
import MissionActivityEvent from './MissionActivityEvent'
import MissionActivityModal from './MissionActivityModal'

export default function MissionActivityList({
  selectedChain,
  tokenSymbol,
  projectId,
}: any) {
  const [missionActivityModalEnabled, setMissionActivityModalEnabled] =
    useState(false)
  const [filter, setFilter] = useState<'all' | 'payEvent' | 'mintTokensEvent'>(
    'all'
  )

  const { data: suckers, refetch } = useSuckers()

  const {
    data: projectEventsQueryResult,
    isLoading: loadingEvents,
    fetchNextPage,
  } = useOmnichainSubgraphProjectEvents({
    filter: filter === 'all' ? undefined : filter,
    sucker: suckers?.find((s: any) => s.peerChainId === selectedChain.id),
    projectId,
  })

  const projectEvents = useMemo(
    () =>
      projectEventsQueryResult?.pages
        .flatMap((page) => page.data.projectEvents)
        .map(transformEventData)
        .filter((event) => !!event)
        .map((e) => translateEventDataToPresenter(e, tokenSymbol)) ?? [],
    [projectEventsQueryResult?.pages]
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
            { label: 'Payments', value: 'payEvent' },
            { label: 'Tokens', value: 'mintTokensEvent' },
          ]}
        />
      </div>
      <div className="flex flex-col gap-4">
        {projectEvents.map((event, i) => (
          <MissionActivityEvent
            key={event?.event.id + i}
            header={event?.header}
            subject={event?.subject}
            extra={event?.extra}
            event={event?.event}
          />
        ))}
        <button className="text-lg text-left" onClick={() => fetchNextPage()}>
          Load more
        </button>
      </div>
      {missionActivityModalEnabled && (
        <MissionActivityModal setEnabled={setMissionActivityModalEnabled} />
      )}
    </div>
  )
}

function RichNote({ note }: { note: string }) {
  return <div className="text-sm break-words">{note}</div>
}

function translateEventDataToPresenter(
  event: any,
  tokenSymbol: string | undefined
) {
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
        extra: <RichNote note={event.note} />,
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
        extra: event.note ? <RichNote note={event.note} /> : null,
      }
    case 'mintTokensEvent':
      return {
        event,
        header: 'Minted tokens',
        subject: (
          <span className="font-heading text-lg">
            {event.amount.format()}{' '}
            {tokenSymbolText({
              capitalize: true,
              tokenSymbol,
              plural: event.amount.toFloat() > 1,
            })}
          </span>
        ),
        extra: <RichNote note={event.note} />,
      }
    case 'cashOutEvent':
      return {
        event,
        header: 'Cashed out',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.reclaimAmount.value} />
          </span>
        ),
        extra: <RichNote note={event.metadata} />,
      }
    case 'deployedERC20Event':
      return {
        event,
        header: 'Deployed ERC20',
        subject: <span className="font-heading text-lg">{event.symbol}</span>,
        extra: <RichNote note={event.address} />,
      }
    case 'projectCreateEvent':
      return {
        event,
        header: 'Created',
        subject: 'Project created 🎉',
        extra: null,
      }
    case 'distributePayoutsEvent':
      return {
        event,
        header: 'Distributed payouts',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: (
          <RichNote
            note={`Fee: ${event.fee.value}, Paid out: ${event.amountPaidOut.value}`}
          />
        ),
      }
    case 'distributeReservedTokensEvent':
      return {
        event,
        header: 'Distributed reserved tokens',
        subject: (
          <span className="font-heading text-lg">
            {Number(event.tokenCount)}{' '}
            {tokenSymbolText({ tokenSymbol, plural: event.tokenCount > 1 })}
          </span>
        ),
        extra: null,
      }
    case 'distributeToReservedTokenSplitEvent':
      return {
        event,
        header: 'Distributed to reserved token split',
        subject: (
          <span className="font-heading text-lg">
            {Number(event.tokenCount)}{' '}
            {tokenSymbolText({ tokenSymbol, plural: event.tokenCount > 1 })}
          </span>
        ),
        extra: (
          <RichNote
            note={`Percent: ${event.percent}, Split project: ${event.splitProjectId}`}
          />
        ),
      }
    case 'distributeToPayoutSplitEvent':
      return {
        event,
        header: 'Distributed to payout split',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: (
          <RichNote
            note={`Percent: ${event.percent}, Split project: ${event.splitProjectId}`}
          />
        ),
      }
    case 'useAllowanceEvent':
      return {
        event,
        header: 'Used allowance',
        subject: (
          <span className="font-heading text-lg">
            <NativeTokenValue decimals={8} wei={event.amount.value} />
          </span>
        ),
        extra: <RichNote note={event.note} />,
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
        extra: (
          <RichNote
            note={`Staked: ${event.stakedAmount.value}, ERC20: ${event.erc20Amount.value}`}
          />
        ),
      }
  }
}
